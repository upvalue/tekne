# tekne

Tekne (formerly
[meditations](https://github.com/upvalue/tekne/tree/meditations-stable)) is a
freestyle productivity app in the shape of an outline editor. 

The basic idea is that you write out tags, add data anywhere within those tags
(such as how much time you spent on something), and you get an overview of the
data in those tags over time. It's really easier to understand with a short
video.

The best way to get started is with the [live demo](https://demo.tekne.app)
which has some built in help and a tutorial.

## Credits

Tekne is released under the AGPL. Tekne depends on a lot of projects, here are a couple:

- Codemirror and `@lezer/markdown` form the core of the editor
- Some Tailwind Plus templates and Tailwind Catalyst are used with a license for the app and website
- General stack: React with tanstack-router, Express/oRPC for server, postgres (& pglite) for
  database, Jotai for state management
- Theme was heavily inspired by Zed 
