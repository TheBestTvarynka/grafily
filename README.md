# Grafily

Grafily is an Obsidian plugin for rendering family graph (family trees).
It uses the [reactflow](https://reactflow.dev/) library for rendering and custom layout algorithm for placing graph nodes.

This plugin is useful for family history/genealogy research, tracking family members, etc.

## Motivation

I started my family research in 2025. I did not want to store all information in some third-party side (aka [myheritage.com](https://myheritage.com)).
I wanted to own all private information, photos, stories, interview recordings with my relatives, and much more.

So, I decided to use [Obsidian](https://obsidian.md/). There are plenty of reasons why Obsidian:

1. I own my data.
2. Easy to use.
3. Obsidian has a powerful plugin API.

But there was a problem: I did not find any suitable plugin to render a pretty graph of family relationships. So, I decided to write my own plugin.
The Grafily has one concrete purpose:it is _**a tree-like viewer for family members' relationships**_.
**The Grafily never modifies your vault content.**

### How it works

The overall idea is simple. The Grafily expects that your vault has one page per person.
The Grafily scans all pages in the directory (the directory is configurable), extracts persons' metadata (see the [Usage](#usage) section for the metadata format), builds an internal relationship graph, and then renders a pretty tree-like graph that you can easily navigate and view family members.

## Installation

> [!NOTE]  
> Currently, the plugin has not been submitted to the [official list of plugins](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json) because it is still in active development and not ready for widespread use.

You can try this plugin by cloning the repo and enabling it in the Obsidian vault settings.

1. Clone the repo into the `plugins/` directory:
   ```bash
   mkdir -p {vault}/.obsidian/plugins/
   cd {vault}/.obsidian/plugins/
   git clone https://github.com/TheBestTvarynka/grafily.git
   ```
2. Enable the Grafily plugin in Obsidian settings (`Community Plugins` section).

## Usage

As I said above, Grafily expects that your vault has one page per person. But it does not mean that all pages in the vault must be dedicated only to persons.

- First of all, Grafily will scan only pages in the specified directory in the plugin settings.
- Secondly, Grafily will accept only pages that include all required metadata.

### Metadata

Grafily expects some predefined information at the start of each page. Here is a metadata template:

```md
# <surname> <name>

**Spouse**: [[<spouse page>]]
**Parents**: [[<1st parent page>]], [[<2nd parent page>]]
**Birth**: <year>-<month>-<day>
**Death**: <year>-<month>-<day>
**Image**: [[<profile picture file>]]

---

Person's page.
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

You can out any information you want after the `---`. The `# <surname> <name>` data is required. All other key-value pairs are optional.
You can add any other key-value pairs to the metadata you want.

Moreover, you do not need to specify the spouse link for both - only one link is enough.
For example, if you specified in the metadata that Bob's spouse is Emma, then it is not required to specify Bob in Emma's metadata.

But pay attention: if the person is not connected to the graph in any way, it will not be rendered.
All persons in the graph must be part of the one graph.

## Showcase

## BDFL

Did you hear about [BDFL](https://en.m.wikipedia.org/wiki/Benevolent_dictator_for_life)?

TL;DR:

> **Benevolent dictator for life (BDFL)** is a title given to a small number of open-source software development leaders, typically project founders who retain the final say in disputes or arguments within the community.

For the Grafily project, the BDFL is [@TheBestTvarynka (Pavlo Myroniuk)](https://github.com/TheBestTvarynka), original creator of Grafily.
