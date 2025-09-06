import React from 'react'
import {
  Fragment as _Fragment,
  jsx as _jsx,
  jsxs as _jsxs,
} from 'react/jsx-runtime'
import { ExternalLink } from '@/components/ExternalLink'

export const metadata = {
  title: 'About',
}

export interface AboutProps {
  components?: Record<string, React.ComponentType<any>>
  [key: string]: any
}

function _createMdxContent(props: any) {
  const _components = {
    a: 'a',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    li: 'li',
    p: 'p',
    ul: 'ul',
    ...(props.components || {}),
  }
  return (
    <>
      <_components.h1>{'About'}</_components.h1>
      {'\n'}
      <_components.p>
        {
          'Tekne is a freestyle productivity app in the shape of an outline editor.'
        }
      </_components.p>
      {'\n'}
      <_components.h2>{'Motivation'}</_components.h2>
      {'\n'}
      <_components.p>
        {
          "Its interface is an outline editor like Logseq (everything in a document is part of a line). But\nit's actually descended from a Trello board I used which grew into a standalone application called\nMeditations. The application would track repeated habitual tasks (like exercise) across months and\nyears."
        }
      </_components.p>
      {'\n'}
      <_components.p>
        {
          'Having my progress on these over time spread out on the screen by default was very useful to me, but\nit was not very flexible and being the first substantial frontend project I ever wrote (it used\njquery, then Riot, then React) was showing its age. I since spent a lot of time using Obsidian and\nfelt that a more open ended editor was the right way forward.'
        }
      </_components.p>
      {'\n'}
      <_components.p>{'A couple of other inspirations:'}</_components.p>
      {'\n'}
      <_components.ul>
        {'\n'}
        <_components.li>
          <_components.a href="https://antirez.com/news/51">
            {'Log driven programming'}
          </_components.a>
        </_components.li>
        {'\n'}
        <_components.li>
          <_components.a href="https://bulletjournal.com/pages/book">
            {'The bullet journal method'}
          </_components.a>
        </_components.li>
        {'\n'}
        <_components.li>
          <_components.a href="https://davidcain.gumroad.com/l/howtodothings/2024isover">
            {'How to do things'}
          </_components.a>
        </_components.li>
        {'\n'}
      </_components.ul>
      {'\n'}
      <_components.h2>{'Apologia'}</_components.h2>
      {'\n'}
      <_components.p>
        {"Here's a few flaws (or design decisions) elaborated on."}
      </_components.p>
      {'\n'}
      <_components.h3>
        {"It's probably not a great outline editor"}
      </_components.h3>
      {'\n'}
      <_components.p>
        {
          "I've never actually used an outline editor for more than a few minutes, although I did make a real\nattempt at org-mode many many years ago."
        }
      </_components.p>
      {'\n'}
      <_components.p>
        {
          "While the interface and keybindings behave like outline editors, it's only my Plato's cave\nreproduction of one."
        }
      </_components.p>
      {'\n'}
      <_components.h3>{'and definitely not a note taking app'}</_components.h3>
      {'\n'}
      <_components.p>
        {'I use '}
        <_components.a href="https://obsidian.md/">{'Obsidian'}</_components.a>
        {
          ' for taking notes. Tekne will have some Markdown features for\nformatting text nicely, but in general as soon as I find myself writing more than a sentence on a\nline I try to get out of it and into Obsidian.'
        }
      </_components.p>
      {'\n'}
      <_components.h3>{"It doesn't store pure text"}</_components.h3>
      {'\n'}
      <_components.p>
        {
          "I like Obsidian's Markdown and filesystem-first nature, but because Tekne's core feature is storing\nand analyzing data that's floating around near text, it didn't seem right. It would certainly be\npossible to store the data as text, but I figure I'd end up putting JSON all over everything anyway\nand at that point a lot of the benefits are gone."
        }
      </_components.p>
      {'\n'}
      <_components.p>
        {'Markdown export will be added at some point.'}
      </_components.p>
      {'\n'}
      <_components.h3>
        {'You can only edit text on a per-line basis'}
      </_components.h3>
      {'\n'}
      <_components.p>
        {
          "Due to skill issues on my part, several initial experiments with a single document editor (instead\nof a per-line editor) didn't pan out. That may eventually be changed."
        }
      </_components.p>
    </>
  )
}
function About(props: AboutProps = {}) {
  const { wrapper: MDXLayout } = props.components || {}
  return MDXLayout ? (
    <MDXLayout {...props}>
      <_createMdxContent {...props} />
    </MDXLayout>
  ) : (
    _createMdxContent(props)
  )
}

export default function AboutWrapper(props: AboutProps = {}) {
  const customComponents = {
    a: ({ href, children, ...rest }: any) => {
      // Check if it's an external link
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        return (
          <ExternalLink href={href} {...rest}>
            {children}
          </ExternalLink>
        )
      }
      // Internal links use regular anchor
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      )
    },
    ...props.components,
  }

  return <About {...props} components={customComponents} />
}
