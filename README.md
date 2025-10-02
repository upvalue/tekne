# tekne

Tekne (formerly [meditations](https://github.com/upvalue/tekne/tree/meditations-stable)) is a
freestyle productivity app in the shape of an outline editor.

It's currently extremely alpha software! I'm using it every day now (as of 10/1/25) but it's missing
lots of features, is sometimes broken in odd ways and does not yet have a stable database or
document schema.

- [tekne.app](https://tekne.app) - website
- [Demo](https://demo.tekne.app) - live demo; the built-in application help on the right
  has some help with syntax and keyboard shortcuts 

## Credits

Tekne is released under the AGPL. Tekne depends on a lot of projects, here are a couple:

- Codemirror and `@lezer/markdown` form the core of the editor 
- Some Tailwind Plus templates and Tailwind Catalyst are used with a license for the app and website
- General stack: React with tanstack-router, express/TRPC for server, postgres (& pglite) for
  database, Jotai for state management

