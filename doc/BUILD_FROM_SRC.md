- [Build the plugin](#build-the-plugin)
- [Install the plugin](#install-the-plugin)

## Build the plugin

```bash
git clone https://github.com/TheBestTvarynka/grafily.git
cd grafily
npm install
npm run build
```

## Install the plugin

Run the commands below in the same directory where you ran `npm run build` above.

```bash
VAULT_DIR=/path/to/vault
GRAFILY_DIR=${VAULT_DIR}/.obsidian/plugins/grafily
mkdir -p ${GRAFILY_DIR}

cp main.js ${GRAFILY_DIR}
cp styles.css ${GRAFILY_DIR}
cp manifest.json ${GRAFILY_DIR}
```
