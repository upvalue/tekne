use crate::generated::{
    ApiOpError, HttpClient, SearchQueryRequest, SearchQueryRequestGroupBy, SearchQueryResponse,
};
use crate::{api_root, terminal_text};
use anyhow::{Context, Result, bail};
use clap::Args;
use reqwest::Client;
use std::time::Duration;

#[derive(Args)]
#[command(
    after_help = "Examples:\n  tkne search '#exercise doc:today'\n  tkne search 'doc:today' --sum time\n  tkne search 'created:today has:timer' --sum time --group-by tag --json\n  tkne search 'created:2026-10-01..2026-10-18' --count\n\nTime is the duration recorded on matching entries, not session history.\nDates use the local timezone unless --timezone or TEKNE_TIMEZONE overrides it."
)]
pub struct SearchArgs {
    /// Query: #exercise doc:today, created:today, status:complete, has:timer, or text
    #[arg(default_value = "")]
    query: String,
    /// Emit the structured API response, with durations in seconds
    #[arg(long)]
    json: bool,
    /// Only show the number of matching entries
    #[arg(long)]
    count: bool,
    /// Sum recorded durations across all matching entries
    #[arg(long, value_parser = ["time"])]
    sum: Option<String>,
    /// Group counts and durations (tag groups may overlap)
    #[arg(long, value_parser = ["tag", "document"])]
    group_by: Option<String>,
    /// Timezone for today/yesterday and date boundaries
    #[arg(long, env = "TEKNE_TIMEZONE", default_value_t = local_timezone())]
    timezone: String,
    /// Maximum entries in this page; totals always cover all matches
    #[arg(long, default_value_t = 50, value_parser = clap::value_parser!(u32).range(1..=100))]
    limit: u32,
    /// Continue at nextCursor from a previous response
    #[arg(long, default_value_t = 0)]
    cursor: u32,
}

fn local_timezone() -> String {
    iana_time_zone::get_timezone().unwrap_or_else(|_| "UTC".to_owned())
}

fn duration(seconds: f64) -> String {
    let sign = if seconds < 0.0 { "-" } else { "" };
    let seconds = seconds.abs();
    let hours = (seconds / 3600.0).floor();
    let minutes = ((seconds % 3600.0) / 60.0).floor();
    let rest = seconds % 60.0;
    let mut parts = Vec::new();
    if hours > 0.0 {
        parts.push(format!("{hours}h"));
    }
    if minutes > 0.0 {
        parts.push(format!("{minutes}m"));
    }
    if rest > 0.0 || parts.is_empty() {
        parts.push(format!("{rest}s"));
    }
    format!("{sign}{}", parts.join(" "))
}

fn render(response: &SearchQueryResponse, args: &SearchArgs) -> String {
    let mut output = format!(
        "{} · {}\n\n",
        response.today,
        terminal_text(&response.timezone)
    );
    for item in &response.items {
        let status = match item.task_status.as_ref().map(|s| s.as_str()) {
            Some("complete") => "[x] ",
            Some("incomplete") => "[ ] ",
            _ => "",
        };
        let time = item
            .time_seconds
            .map(|s| format!(" · {}", duration(s)))
            .unwrap_or_default();
        output.push_str(&format!(
            "{}:{}  {}{}{}\n",
            terminal_text(&item.document),
            item.line_index + 1.0,
            status,
            terminal_text(&item.content),
            time
        ));
        if !item.tags.is_empty() {
            output.push_str(&format!("  {}\n", terminal_text(&item.tags.join(" "))));
        }
    }
    for group in &response.groups {
        let key = terminal_text(group.key.as_deref().unwrap_or("Untagged"));
        if args.count && args.sum.is_none() {
            output.push_str(&format!("{key}  {} entries\n", group.matched_count));
        } else {
            output.push_str(&format!(
                "{key}  {} · {} entries\n",
                duration(group.time_seconds),
                group.matched_count
            ));
        }
    }
    if !response.items.is_empty() || !response.groups.is_empty() {
        output.push('\n');
    }
    if args.count && args.sum.is_none() {
        output.push_str(&format!(
            "{} matching entries\n",
            response.summary.matched_count
        ));
    } else {
        output.push_str(&format!(
            "{} matching entries · {} recorded across {} timed entries\n",
            response.summary.matched_count,
            duration(response.summary.time_seconds),
            response.summary.timed_entry_count
        ));
    }
    if response.groups_overlap {
        output.push_str("Tag groups overlap; the overall total counts each entry once.\n");
    }
    if let Some(cursor) = response.next_cursor {
        output.push_str(&format!("More results: repeat with --cursor {cursor}\n"));
    }
    output
}

pub async fn run(base: &str, args: SearchArgs) -> Result<String> {
    let client = Client::builder().timeout(Duration::from_secs(20)).build()?;
    let client =
        HttpClient::with_client_and_config(client, false).with_base_url(api_root(base)?.as_str());
    let request = SearchQueryRequest {
        query: args.query.clone(),
        timezone: Some(args.timezone.clone()),
        limit: Some(args.limit.into()),
        cursor: Some(args.cursor.into()),
        summary_only: Some(args.count || args.sum.is_some() || args.group_by.is_some()),
        group_by: args.group_by.as_ref().map(|group| {
            if group == "tag" {
                SearchQueryRequestGroupBy::Tag
            } else {
                SearchQueryRequestGroupBy::Document
            }
        }),
    };
    let response = match client.search_query(request).await {
        Ok(response) => response,
        Err(ApiOpError::Api(error)) => {
            let message = serde_json::from_slice::<serde_json::Value>(&error.raw_body)
                .ok()
                .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(str::to_owned));
            bail!(
                "Tekne returned HTTP {}: {}",
                error.status,
                message.unwrap_or_else(|| error.parse_error.unwrap_or_default())
            );
        }
        Err(error) => return Err(error).context("Could not reach Tekne; check --url or TEKNE_URL"),
    };
    if args.json {
        Ok(format!("{}\n", serde_json::to_string_pretty(&response)?))
    } else {
        Ok(render(&response, &args))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    fn args(extra: &[&str]) -> SearchArgs {
        let mut argv = vec![
            "tkne",
            "search",
            "#exercise doc:today",
            "--timezone",
            "America/Los_Angeles",
        ];
        argv.extend_from_slice(extra);
        match crate::Args::try_parse_from(argv).unwrap().command {
            crate::Command::Search(args) => args,
            _ => panic!("expected search"),
        }
    }

    fn serve(status: &str, body: String) -> (String, std::thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let status = status.to_owned();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            loop {
                let mut buffer = [0; 4096];
                let n = stream.read(&mut buffer).unwrap();
                assert!(n > 0);
                request.extend_from_slice(&buffer[..n]);
                if let Some(end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..end]);
                    let length: usize = headers
                        .lines()
                        .find_map(|line| {
                            line.to_lowercase()
                                .strip_prefix("content-length:")
                                .map(|s| s.trim().parse().unwrap())
                        })
                        .unwrap();
                    if request.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            write!(stream, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            String::from_utf8(request).unwrap()
        });
        (url, handle)
    }

    fn response() -> serde_json::Value {
        serde_json::json!({
            "query": "#exercise doc:today", "today": "2026-10-18", "timezone": "America/Los_Angeles",
            "asOf": "2026-10-18T18:00:00Z", "groupBy": "tag", "groupsOverlap": true,
            "items": [{"lineId": "example", "document": "2026-10-18", "lineIndex": 1,
                "content": "Run", "indent": 1, "tags": ["#exercise"], "taskStatus": "complete",
                "timeSeconds": 2700, "timeCreated": null, "timeUpdated": null}],
            "summary": {"matchedCount": 8, "timedEntryCount": 6, "timeSeconds": 19800},
            "groups": [{"key": "#exercise", "matchedCount": 2, "timeSeconds": 3600}], "nextCursor": 1
        })
    }

    #[tokio::test]
    async fn sends_search_options_and_preserves_json() {
        let expected = response();
        let (url, server) = serve("200 OK", expected.to_string());
        let output = run(
            &format!("{url}/tekne/"),
            args(&["--sum", "time", "--group-by", "tag", "--json"]),
        )
        .await
        .unwrap();
        let actual: serde_json::Value = serde_json::from_str(&output).unwrap();
        assert_eq!(actual["summary"]["timeSeconds"].as_f64(), Some(19800.0));
        assert!(actual["items"][0]["timeUpdated"].is_null());
        let request = server.join().unwrap();
        assert!(request.starts_with("POST /tekne/api/v1/search/query HTTP/1.1"));
        let body: serde_json::Value =
            serde_json::from_str(request.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        assert_eq!(body["query"], "#exercise doc:today");
        assert_eq!(body["summaryOnly"], true);
        assert_eq!(body["groupBy"], "tag");
        assert_eq!(body["timezone"], "America/Los_Angeles");
    }

    #[test]
    fn renders_totals_overlap_and_pagination_without_terminal_controls() {
        let mut value = response();
        value["items"][0]["content"] = "Run\u{1b}[2J".into();
        let response: SearchQueryResponse = serde_json::from_value(value).unwrap();
        let text = render(&response, &args(&[]));
        assert!(text.contains("[x] Run"));
        assert!(text.contains("5h 30m recorded"));
        assert!(text.contains("Tag groups overlap"));
        assert!(text.contains("--cursor 1"));
        assert!(!text.contains('\u{1b}'));
    }

    #[tokio::test]
    async fn reports_server_query_errors() {
        let (url, server) = serve(
            "400 Bad Request",
            r#"{"message":"Unknown operator: tracked"}"#.to_owned(),
        );
        let error = run(&url, args(&[])).await.unwrap_err().to_string();
        assert!(error.contains("Unknown operator: tracked"));
        server.join().unwrap();
    }

    #[test]
    fn durations_keep_seconds_and_fractional_values() {
        assert_eq!(duration(0.0), "0s");
        assert_eq!(duration(19800.0), "5h 30m");
        assert_eq!(duration(3601.5), "1h 1.5s");
    }
}
