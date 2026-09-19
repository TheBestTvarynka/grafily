# Metadata

Grafily expects your vault to have **one page per person**. But that doesn't mean all pages in the vault must be dedicated only to people.

- Grafily will scan only pages in **the specified directory in the plugin settings**.
- Grafily will accept **only pages that include all required metadata**.

Metadata is predefined information at the start of each page. Here is a metadata template:

```md
# <surname> <name>

**Spouse**: [[<spouse page>]]
**Parents**: [[<1st parent page>]], [[<2nd parent page>]]
**Birth**: <year>-<month>-<day>
**Death**: <year>-<month>-<day>
**Image**: [[<profile picture file>]]
**Children**: [[<1st children page>]], [[<2nd children page>]], ...

---

Person's page content.
```

Example:

```md
# Myroniuk Pavlo

**Spouse**: [[Kateryna]]
**Parents**: [[Yaroslav]], [[Halyna]]
**Birth**: 2001-07-10
**Image**: [[images/TheBestTvarynka.png]]

---

Hi there 👋
```

You can type any information you want after the `---`. The `# <surname> <name>` line is required. All other key-value pairs are optional, and you can specify them in any order.
You can also add any other key-value pairs to the metadata you want (they will be ignored).

Moreover, you don't need to specify the spouse link for both; one link is sufficient. For example, if you specify in Bob's metadata that his spouse is Emma, then it is not required to specify Bob in Emma's metadata.

Now that you understand the metadata format and its meaning, you are ready to follow the [Getting started](./GETTING_STARTED.md) guide to see the plugin in action.

## Shortcut buttons

It's not always convenient to build a family graph from the plugin start-up menu. Often we _just_ want to build a relationships graph of the current person. In that case, the Grafily plugin supports the `grafily-navigation` code block:

````
    ```grafily-navigation
    ```
````

It will be rendered as two buttons for quick and easy graph building:

![](./images/grafily-navigation-buttons.png)

The left button opens the family tree of the current person (`Reingold-Tilford` layout). The right button opens the graph explorer with the starting person as the current person (`Brandes-Köpf` layout). Example:

![](./images/grafily-navigation-showcase.gif)
