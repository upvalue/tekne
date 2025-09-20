/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { ExternalLink } from '@/components/ExternalLink';

export const metadata = {
  "title": "Development"
};

export interface DevelopmentProps {
  components?: Record<string, React.ComponentType<any>>;
  [key: string]: any;
}

function _createMdxContent(props: any) {
  const _components = {
    blockquote: "blockquote",
    code: "code",
    h3: "h3",
    h4: "h4",
    p: "p",
    ...(props.components || {})
  };
  return <><_components.h3>{"Development"}</_components.h3>{"\n"}<_components.p>{"Tekne is a full stack application written with a React (tanstack-router + vite) frontend,\nNodeJS+express backend, and postgres as the database."}</_components.p>{"\n"}<_components.h4>{"Running"}</_components.h4>{"\n"}<_components.p>{"Tekne has a few different development \"modes\" for trading off convenience vs. fidelity to a\nproduction environment."}</_components.p>{"\n"}<_components.p>{"The default and recommended way of developing is with"}</_components.p>{"\n"}<_components.blockquote>{"\n"}<_components.p>{"pnpm run dev:client-only"}</_components.p>{"\n"}</_components.blockquote>{"\n"}<_components.p>{"This will run a frontend-only version with TRPC and postgres (via pglite) in the browser."}</_components.p>{"\n"}<_components.p>{"Some features (currently only hooks) require a full server and it's also helpful to debug issues\nwith deploying to production. In which case you can run"}</_components.p>{"\n"}<_components.blockquote>{"\n"}<_components.p>{"pnpm run dev:client-with-server"}</_components.p>{"\n"}</_components.blockquote>{"\n"}<_components.p>{"To run a postgres database (via "}<_components.code>{"docker-compose.yml"}</_components.code>{"), the server and client all at once."}</_components.p>{"\n"}<_components.h4>{"Deploying and running database migrations"}</_components.h4>{"\n"}<_components.p>{"There's currently a very alpha Docker image based on Alpine that can be used to deploy the\napplication to production. The only required environment variable you'll need to set in that case is\n"}<_components.code>{"DATABASE_URL"}</_components.code>{" to a postgres database URL (see "}<_components.code>{"package.json"}</_components.code>{" for an example)"}</_components.p>{"\n"}<_components.p>{"Database access is with kysely; with "}<_components.code>{"DATABASE_URL"}</_components.code>{" set, use"}</_components.p>{"\n"}<_components.blockquote>{"\n"}<_components.p>{"pnpm kysely"}</_components.p>{"\n"}</_components.blockquote>{"\n"}<_components.p>{"To run database migrations or other database ops. Note that when running in client-only mode, all\ndatabase migrations are already applied"}</_components.p>{"\n"}<_components.p>{"There's a bit more detail about the setup albeit scattered in "}<_components.code>{"CLAUDE.md"}</_components.code></_components.p></>;
}
function Development(props: DevelopmentProps = {}) {
  const {wrapper: MDXLayout} = (props.components || {});
  return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
}


export default function DevelopmentWrapper(props: DevelopmentProps = {}) {
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
  
  return <Development {...props} components={customComponents} />;
}
