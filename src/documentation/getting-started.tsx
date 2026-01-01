/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { ExternalLink } from '@/components/ExternalLink';

export const metadata = {
  "title": "Getting Started"
};

export interface GettingStartedProps {
  components?: Record<string, React.ComponentType<any>>;
  [key: string]: any;
}

function _createMdxContent(props: any) {
  const _components = {
    code: "code",
    h3: "h3",
    h4: "h4",
    p: "p",
    pre: "pre",
    ...(props.components || {})
  };
  return <><_components.h3>{"Getting Started"}</_components.h3>{"\n"}<_components.p>{"The best place to get started with Tekne right now is by reading the Tutorial document."}</_components.p>{"\n"}<_components.p>{"If you missed it, you can use the \"Restart Tutorial\" command in the command palette\n("}<_components.code>{"Cmd-K"}</_components.code>{") to start it again."}</_components.p>{"\n"}<_components.h4>{"Editor"}</_components.h4>{"\n"}<_components.p>{"For help using the editor, check out the "}<_components.code>{"Editor Syntax"}</_components.code>{" and "}<_components.code>{"Keyboard Shortcuts"}</_components.code>{" help\narticles."}</_components.p>{"\n"}<_components.h4>{"Aggregate view"}</_components.h4>{"\n"}<_components.p>{"The aggregate view is automatically created when you tag data, and shows summaries of all\nthe data for the tag. For example, if you created a document like this:"}</_components.p>{"\n"}<_components.pre><_components.code>{"- #tag\n-   <successful task>\n-   <30min timer>\n"}</_components.code></_components.pre>{"\n"}<_components.p>{"The aggregate view would then show you how many tasks are complete, incomplete or have no\nstatus, as well as the overall time spent on them."}</_components.p>{"\n"}<_components.p>{"The aggregate view is automatically generated based on the tags in the currently open document."}</_components.p>{"\n"}<_components.p>{"More control and features are coming soon."}</_components.p></>;
}
function GettingStarted(props: GettingStartedProps = {}) {
  const {wrapper: MDXLayout} = (props.components || {});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}


export default function GettingStartedWrapper(props: GettingStartedProps = {}) {
  const customComponents = {
    a: ({ href, children, ...rest }: any) => {
      // Check if it's an external link
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        return <ExternalLink href={href} {...rest}>{children}</ExternalLink>;
      }
      // Internal links use regular anchor
      return <a href={href} {...rest}>{children}</a>;
    },
    ...props.components
  };
  
  return <GettingStarted {...props} components={customComponents} />;
}
