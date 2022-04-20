let config

try {
  config = require('./config.json')
} catch(e) {
  console.warn("Couldn't find config.json, so falling back to environment variables.")
  config = process.env
}

const fs = require('fs').promises

const { promisify } = require('util')

const execOld = promisify(require('child_process').exec)

const rimraf = promisify(require('rimraf'))

const requestOld = require('request')
const Octokit = require('@octokit/rest')

const path = require('path')

const { Parser } = require('tl-to-json')

const octokit = new Octokit({
  auth: `token ${config.GITHUB_ACCESS_TOKEN}`
})

async function request(url) {
  return new Promise((resolve, reject) => {
    requestOld(url, { }, (err, res, body) => {
      if(!err) resolve({ res, body })
      if(err) reject(err)
    })
  })
}

async function wait(ms) {
  return new Promise((resolve, reject) => { setTimeout(() => { resolve() }, ms)})
}

async function exec(cmd, opts) {
  console.log(`  > ${cmd}`)
  return await execOld(cmd, opts)
}

async function start() {
  const layerRegex = /\/\/ LAYER ([0-9]+)/

  const { body: currentSchema } = await request(`https://raw.githubusercontent.com/tjhorner/schema.tl/master/resources/schema.tl?${Date.now()}`)
  const currentLayerNumber = parseInt(currentSchema.match(layerRegex)[1])
  console.log("Latest fetched layer number:", currentLayerNumber)

  const { body: latestSchema } = await request(`https://raw.githubusercontent.com/telegramdesktop/tdesktop/dev/Telegram/Resources/tl/api.tl?${Date.now()}`)
  const newLayerNumber = parseInt(latestSchema.match(layerRegex)[1])
  console.log("New fetched layer number:", newLayerNumber)

  if(Number.isNaN(currentLayerNumber) || newLayerNumber > currentLayerNumber) {
    console.log("Current layer is NaN or new > current, starting PR process...")

    console.log("Checking for open PRs before we go any further...")

    const { data: openPulls } = await octokit.pulls.list({
      owner: "tjhorner",
      repo: "schema.tl",
      state: "open",
      head: `tjhorner:layer-${newLayerNumber}`
    })

    if(openPulls.length > 0) {
      console.log(openPulls)
      console.log("There is an open PR for this layer; aborting.")
      process.exit(0)
    }

    console.log("No open PRs for this layer; continuing...")

    await rimraf(config.REPO_WORKING_DIRECTORY)

    console.log("Creating working directory if it does not already exist...")

    await fs.mkdir(config.REPO_WORKING_DIRECTORY)

    console.log("Cloning repository...")

    await exec(`git clone --depth=1 git@github.com:tjhorner/schema.tl.git ${config.REPO_WORKING_DIRECTORY}`)

    console.log(`Checking out new branch layer-${newLayerNumber}...`)

    await exec(`git checkout -b layer-${newLayerNumber}`, { cwd: config.REPO_WORKING_DIRECTORY })

    console.log("Converting new schema to JSON...")

    const parser = new Parser(latestSchema)
    const newSchema = JSON.parse(parser.getJSON())

    console.log("Writing new schema to working directory...")

    await fs.writeFile(path.join(config.REPO_WORKING_DIRECTORY, "resources", "schema.json"), JSON.stringify(newSchema, null, 2))
    await fs.writeFile(path.join(config.REPO_WORKING_DIRECTORY, "resources", "schema.tl"), latestSchema)

    console.log("Ensuring all documentation files for methods/constructors exist...")

    const newDocs = { methods: [ ], constructors: [ ] }

    newSchema.methods.forEach(async method => {
      const docPath = path.join(config.REPO_WORKING_DIRECTORY, "docs", "methods", `${method.method}.md`)

      try {
        await fs.open(docPath, "r")
      } catch(e) {
        console.log(`Writing empty doc file for new method ${method.method}...`)
        newDocs.methods.push(method.method)
        await fs.writeFile(docPath, "")
      }
    })

    newSchema.constructors.forEach(async constructor => {
      const docPath = path.join(config.REPO_WORKING_DIRECTORY, "docs", "constructors", `${constructor.predicate}.md`)

      try {
        await fs.open(docPath, "r")
      } catch(e) {
        console.log(`Writing empty doc file for new constructor ${constructor.predicate}...`)
        newDocs.constructors.push(constructor.predicate)
        await fs.writeFile(docPath, "")
      }
    })

    console.log("Replacing schema in schema.js and updating version number...")

    var schemaJs = (await fs.readFile(path.join(config.REPO_WORKING_DIRECTORY, "js", "schema.js"))).toString()
    schemaJs = schemaJs.replace(/var LAYER_NUMBER = [0-9]+/, `var LAYER_NUMBER = ${newLayerNumber}`)
    schemaJs = schemaJs.replace(/var SCHEMA_GLOBAL = {[\s\S]+}/, `var SCHEMA_GLOBAL = ${JSON.stringify(newSchema, null, 2)}`)

    await fs.writeFile(path.join(config.REPO_WORKING_DIRECTORY, "js", "schema.js"), schemaJs)

    console.log("For my final trick, updating the layer number on the index page...")

    var indexHtml = (await fs.readFile(path.join(config.REPO_WORKING_DIRECTORY, "index.html"))).toString()
    indexHtml = indexHtml.replace(/TL-Schema Explorer \(Layer [0-9]+\)/, `TL-Schema Explorer (Layer ${newLayerNumber})`)

    await fs.writeFile(path.join(config.REPO_WORKING_DIRECTORY, "index.html"), indexHtml)

    console.log("Alright, everything has been replaced. Committing changes.")

    await exec(`git add -A && git -c "user.name=${config.GIT_NAME}" -c "user.email=${config.GIT_EMAIL}" commit -m "[chore] Update to layer ${newLayerNumber}"`, { cwd: config.REPO_WORKING_DIRECTORY, shell: "bash" })

    console.log("Pushing changes to GitHub...")

    await exec(`git push origin layer-${newLayerNumber}`, {
      cwd: config.REPO_WORKING_DIRECTORY,
      env: {
        GIT_SSH_COMMAND: `ssh -o IdentitiesOnly=yes -i ${config.GIT_PRIVATE_KEY_PATH}`
      }
    })

    console.log("OK, done! Cleaning up working directory...")

    await rimraf(config.REPO_WORKING_DIRECTORY)

    console.log("Working directory is clean. Submitting the PR...")

    var newDocsText = "### New constructors"

    newDocs.constructors.forEach(constructor => {
      newDocsText += `\n- ${constructor}`
    })

    newDocsText += "\n\n### New methods"

    newDocs.methods.forEach(method => {
      newDocsText += `\n- ${method}`
    })

    newDocsText += "\n\nDocumentation files were created for these new constructors and methods."

    const { data: pr } = await octokit.pulls.create({
      owner: "tjhorner",
      repo: "schema.tl",
      head: `layer-${newLayerNumber}`,
      base: "master",
      title: `chore: Update to layer ${newLayerNumber}`,
      body: `Hello! It's time... time to update the schema layer! This pull request migrates from layer ${currentLayerNumber} to layer ${newLayerNumber}. Please check to make sure I didn't screw anything up!\n\n${newDocsText}\n\nWith ❤️,\nYour Friendly Neighborhood Schemabot`
    })

    await octokit.issues.addLabels({
      owner: "tjhorner",
      repo: "schema.tl",
      number: pr.number,
      labels: [ "layer update" ]
    })

    await octokit.pulls.createReviewRequest({
      owner: "tjhorner",
      repo: "schema.tl",
      number: pr.number,
      reviewers: [ "tjhorner" ]
    })

    console.log("PR created, check it out:", pr.html_url)

    console.log(`\nEverything is done! Updated layer ${currentLayerNumber} -> ${newLayerNumber}.`)
  } else {
    console.log("New layer is the same as current layer. Nothing to change! Bye")
  }
}

start()