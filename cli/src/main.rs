use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use reqwest::{Client, Url};
use std::io::{self, Write};
use std::time::Duration;

#[allow(dead_code)]
mod generated;
mod search;
use generated::{
    ApiOpError, DocLoadDocResponse as Response, DocLoadDocResponseDoc as Document, HttpClient,
};

#[derive(Parser)]
#[command(
    name = "tkne",
    version,
    about = "Read, search, and summarize Tekne entries from your terminal"
)]
struct Args {
    /// Server root URL (including any reverse-proxy path prefix)
    #[arg(
        long,
        env = "TEKNE_URL",
        default_value = "http://localhost:3005",
        global = true
    )]
    url: String,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Search entries or summarize recorded time (quote queries containing #tags)
    Search(search::SearchArgs),
    /// Fetch a document by its exact title and render its full outline
    Show {
        name: String,
        /// Print the complete API response as JSON
        #[arg(long)]
        json: bool,
    },
}

fn api_root(base: &str) -> Result<Url> {
    let mut url = Url::parse(base).context("Invalid server URL")?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        bail!("Server URL must use http or https");
    }
    let path = format!("{}/api/v1", url.path().trim_end_matches('/'));
    url.set_path(&path);
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

async fn fetch(base: &str, name: &str) -> Result<Response> {
    let client = Client::builder().timeout(Duration::from_secs(20)).build()?;
    let client =
        HttpClient::with_client_and_config(client, false).with_base_url(api_root(base)?.as_str());
    match client.doc_load_doc(name).await {
        Ok(response) => Ok(response),
        Err(ApiOpError::Api(error)) if error.status == 404 => {
            bail!("Document {name:?} not found (HTTP 404)")
        }
        Err(ApiOpError::Api(error)) if (200..300).contains(&error.status) => {
            bail!(
                "Tekne returned invalid JSON or an unexpected document response: {}",
                error.parse_error.unwrap_or_default()
            )
        }
        Err(ApiOpError::Api(error)) => bail!("Tekne returned HTTP {}", error.status),
        Err(error) => Err(error).context("Could not reach Tekne; check --url or TEKNE_URL"),
    }
}

// Documents are terminal output, so never pass through escape/control sequences.
fn terminal_text(text: &str) -> String {
    text.chars()
        .filter(|c| !c.is_control() || matches!(c, '\n' | '\t'))
        .collect()
}

fn render(name: &str, doc: &Document) -> Result<String> {
    if doc.schema_version != 2.0 {
        bail!(
            "Unsupported document schema {}; expected 2",
            doc.schema_version
        );
    }
    let mut result = format!("# {}\n\n", terminal_text(name));
    for line in &doc.children {
        // Bound allocation for malformed or unexpectedly deeply nested documents.
        if !(0..=256).contains(&line.indent) {
            bail!("Document indentation must be between 0 and 256 levels");
        }
        let padding = "  ".repeat(line.indent as usize);
        let marker = match line
            .datum_task_status
            .as_ref()
            .map(|status| status.as_str())
        {
            Some("complete") => "[x] ",
            Some("incomplete") => "[ ] ",
            _ => "",
        };
        let content = terminal_text(&line.md_content);
        let mut lines = content.split('\n');
        result.push_str(&format!(
            "{padding}- {marker}{}",
            lines.next().unwrap_or("")
        ));
        if let Some(seconds) = line.datum_time_seconds {
            result.push_str(&format!(" [time: {seconds}s]"));
        }
        if line.datum_pinned_at.is_some() {
            result.push_str(" [pinned]");
        }
        result.push('\n');
        for continuation in lines {
            result.push_str(&format!("{padding}  {continuation}\n"));
        }
    }
    Ok(result)
}

async fn run(args: Args) -> Result<()> {
    let output = match args.command {
        Command::Show { name, json } => {
            let response = fetch(&args.url, &name).await?;
            if json {
                format!("{}\n", serde_json::to_string_pretty(&response)?)
            } else {
                render(&name, &response.doc)?
            }
        }
        Command::Search(search) => search::run(&args.url, search).await?,
    };
    match io::stdout().lock().write_all(output.as_bytes()) {
        Err(error) if error.kind() == io::ErrorKind::BrokenPipe => Ok(()),
        result => result.context("Could not write output"),
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    if let Err(error) = run(Args::parse()).await {
        eprintln!("tkne: {}", terminal_text(&format!("{error:#}")));
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpListener;

    fn serve_once(status: &str, body: &str) -> (String, std::thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            let mut buffer = [0; 1024];
            while !request.windows(4).any(|w| w == b"\r\n\r\n") {
                let count = stream.read(&mut buffer).unwrap();
                assert!(count > 0);
                request.extend_from_slice(&buffer[..count]);
            }
            stream.write_all(response.as_bytes()).unwrap();
            String::from_utf8(request).unwrap()
        });
        (url, handle)
    }

    #[tokio::test]
    async fn fetches_plain_json_over_the_document_api() {
        let (url, server) = serve_once(
            "200 OK",
            r#"{"doc":{"type":"doc","schemaVersion":2,"children":[]},"revision":7}"#,
        );
        let response = fetch(&url, "A & B").await.unwrap();
        assert_eq!(response.revision, 7.0);
        assert_eq!(
            serde_json::to_value(&response).unwrap()["doc"]["type"],
            "doc"
        );
        assert_eq!(render("A & B", &response.doc).unwrap(), "# A & B\n\n");
        assert!(
            server
                .join()
                .unwrap()
                .starts_with("GET /api/v1/documents/content?name=A+%26+B HTTP/1.1\r\n")
        );
    }

    #[tokio::test]
    async fn reports_http_errors_and_non_json_responses() {
        for (status, body, expected) in [
            ("404 Not Found", "{}", "not found"),
            ("500 Internal Server Error", "{}", "HTTP 500"),
            ("200 OK", "<html>wrong server</html>", "invalid JSON"),
            (
                "200 OK",
                r#"{"doc":{},"revision":7}"#,
                "unexpected document response",
            ),
        ] {
            let (url, server) = serve_once(status, body);
            assert!(
                fetch(&url, "Missing")
                    .await
                    .unwrap_err()
                    .to_string()
                    .contains(expected)
            );
            server.join().unwrap();
        }
    }

    #[tokio::test]
    async fn document_titles_are_encoded_as_a_single_query_value() {
        let (base, server) = serve_once(
            "200 OK",
            r#"{"doc":{"type":"doc","schemaVersion":2,"children":[]},"revision":7}"#,
        );
        fetch(&format!("{base}/tekne/?ignored=1#fragment"), "日 / a&b?#")
            .await
            .unwrap();
        let request = server.join().unwrap();
        let path = request.split_whitespace().nth(1).unwrap();
        let url = Url::parse(&format!("{base}{path}")).unwrap();
        assert_eq!(url.path(), "/tekne/api/v1/documents/content");
        assert_eq!(
            url.query_pairs().collect::<Vec<_>>(),
            vec![("name".into(), "日 / a&b?#".into())]
        );
        assert!(api_root("file:///tmp/test").is_err());
    }

    #[test]
    fn renders_structure_and_data_including_collapsed_children() {
        let mut value = serde_json::json!({
            "revision": 4,
            "doc": {"type": "doc", "schemaVersion": 2, "children": [
                {"mdContent": "**Project** #work", "indent": 0, "collapsed": true},
                {"mdContent": "Ship\nDetails", "indent": 1, "datumTaskStatus": "complete", "datumTimeSeconds": 90.5, "datumPinnedAt": "2026-01-01T00:00:00Z"},
                {"mdContent": "Next", "indent": 1, "datumTaskStatus": "incomplete"}
            ]}
        });
        for (index, line) in value["doc"]["children"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .enumerate()
        {
            line["type"] = "line".into();
            line["id"] = format!("l_{}A", "a".repeat(20) + &index.to_string()).into();
            line["timeCreated"] = "2026-01-01T00:00:00Z".into();
            line["timeUpdated"] = "2026-01-01T00:00:00Z".into();
        }
        let response: Response = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(
            serde_json::to_value(&response).unwrap()["doc"]["children"],
            value["doc"]["children"]
        );
        assert_eq!(
            render("Plan", &response.doc).unwrap(),
            "# Plan\n\n- **Project** #work\n  - [x] Ship [time: 90.5s] [pinned]\n    Details\n  - [ ] Next\n"
        );
    }

    #[test]
    fn handles_empty_docs_and_rejects_unknown_schema() {
        let mut doc = Document {
            schema_version: 2.0,
            children: vec![],
            r#type: "doc".into(),
        };
        assert_eq!(render("Empty", &doc).unwrap(), "# Empty\n\n");
        doc.schema_version = 3.0;
        assert!(render("Future", &doc).is_err());
        assert_eq!(terminal_text("safe\x1b[2J\r\x07"), "safe[2J");
    }
}
