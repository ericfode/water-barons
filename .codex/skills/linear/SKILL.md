---
name: linear
description: Use Symphony's injected `linear_graphql` client tool for raw Linear GraphQL operations during unattended issue runs.
---

# Linear

Use this skill only inside a Symphony app-server session where the `linear_graphql` client tool is available.

## Rules

- Send one GraphQL operation per tool call.
- Treat a top-level `errors` array as failure even when the tool call succeeds.
- Keep reads and mutations narrowly scoped.
- Keep one persistent `## Symphony Workpad` comment per issue and edit that comment instead of posting scattered progress comments.

## Common Queries

Read an issue by key:

```graphql
query IssueByKey($key: String!) {
  issue(id: $key) {
    id
    identifier
    title
    url
    description
    branchName
    state { id name type }
    team {
      id
      key
      states { nodes { id name type } }
    }
    project { id name }
    attachments { nodes { id title url sourceType } }
    comments(first: 50) {
      nodes {
        id
        body
        createdAt
        updatedAt
        resolvedAt
      }
    }
  }
}
```

Create the workpad comment:

```graphql
mutation CreateComment($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    success
    comment { id url }
  }
}
```

Update the workpad comment:

```graphql
mutation UpdateComment($id: String!, $body: String!) {
  commentUpdate(id: $id, input: { body: $body }) {
    success
    comment { id body }
  }
}
```

Move an issue to a different state:

```graphql
mutation MoveIssueToState($id: String!, $stateId: String!) {
  issueUpdate(id: $id, input: { stateId: $stateId }) {
    success
    issue { id identifier state { id name } }
  }
}
```

Attach a PR URL:

```graphql
mutation CreateAttachment($issueId: String!, $url: String!, $title: String!) {
  attachmentCreate(input: { issueId: $issueId, url: $url, title: $title }) {
    success
    attachment { id url title }
  }
}
```
