
### Table of contents:

- [Grafily](#grafily)
  - [Showcase](#showcase)
  - [Visualization algorithms](#visualization-algorithms)
  - [How it works](#how-it-works)
  - [Motivation](#motivation)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Metadata](#metadata)
  - [BDFL](#bdfl)

# Grafily

Grafily is an Obsidian plugin for rendering family graph (family trees).
It uses the [reactflow](https://reactflow.dev/) library for rendering and custom layout algorithm for placing graph nodes.

This plugin is useful for family history/genealogy research, tracking family members, etc.

## Showcase



## Visualization algorithms

| name | description | example |
|-|-|-|
| Reingold-Tilford | A *tree-based* visualization algorithm. It will show only direct ancestors and\or descendants of the selected person (e.g. children's children or parent's parents). | |
| Brandes-Köpf | A *graph-based* visualization algorithm. It's a universal rendering algorithm for any family graphs of any complexity. The only disadvantage is not-perfect centering: some children or parents nodes are not perfectly centered. | |

## How it works

The Grafily expects that your vault has one page per person.
The Grafily scans all pages in the directory (the directory is configurable), extracts persons' metadata (see the [Usage](#usage) section for the metadata format), builds an internal relationship graph, and then renders a pretty graph that you can easily navigate and view family members.
The interactive UI allows you to collapse or expand family relationships with other persons (collapse/expand children/parent nodes).

## Motivation

I started my family research in 2025. I did not want to store all information in some third-party side (for instance, [myheritage.com](https://myheritage.com)).
I wanted me to be the owner of the private information, photos, stories, interview recordings with my relatives, and much more.

So, I decided to use [Obsidian](https://obsidian.md/). There are plenty of reasons why Obsidian:

1. I own my data.
2. Easy to use.
3. Obsidian has a powerful plugin API.

But there was a problem: I did not find any suitable plugin to render a pretty graph of family relationships.
So, I decided to write my own plugin.
The Grafily has one concrete purpose: it is _**a viewer for family members' relationships**_.
**The Grafily never modifies your vault content.**

## Installation

> [!NOTE]  
> Currently, the plugin has not been submitted to the [official list of plugins](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json) because I am the only one who uses it.
> If you considered using it and want to see it in the official list of plugins, create an issue.

You can try this plugin by cloning the repo and enabling it in the Obsidian vault settings.

1. Go to the [Releases](https://github.com/TheBestTvarynka/grafily/releases) page and download release assets.
   The archive should contain three files: `main.js`, `manifest.json`, and `styles.css`.
2. Please these files at the vault plugin directory:
   ```bash
   mkdir -p {vault}/.obsidian/plugins/grafily
   cd {vault}/.obsidian/plugins/grafily
   # Place `main.js`, `manifest.json`, and `styles.css` here. 
   ```
2. Enable the Grafily plugin in the Obsidian settings (`Community Plugins` section).

## Usage

As I said above, Grafily expects that your vault has one page per person. But it does not mean that all pages in the vault must be dedicated only to persons.

- Grafily will scan only pages in the specified directory in the plugin settings.
- Grafily will accept only pages that include all required metadata.

### Metadata

Grafily expects predefined information at the start of each page. Here is a metadata template:

```md
# <surname> <name>

**Spouse**: [[<spouse page>]]
**Parents**: [[<1st parent page>]], [[<2nd parent page>]]
**Birth**: <year>-<month>-<day>
**Death**: <year>-<month>-<day>
**Image**: [[<profile picture file>]]

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

You can type any information you want after the `---`. The `# <surname> <name>` line is required. All other key-value pairs are optional.
You can add any other key-value pairs to the metadata you want.

Moreover, you do not need to specify the spouse link for both - only one link is enough.
For example, if you specified in the metadata that Bob's spouse is Emma, then it is not required to specify Bob in Emma's metadata.

## BDFL

Did you hear about [BDFL](https://en.m.wikipedia.org/wiki/Benevolent_dictator_for_life)?

TL;DR:

> **Benevolent dictator for life (BDFL)** is a title given to a small number of open-source software development leaders, typically project founders who retain the final say in disputes or arguments within the community.

For the Grafily project, the BDFL is [@TheBestTvarynka (Pavlo Myroniuk)](https://github.com/TheBestTvarynka), original creator of Grafily.
