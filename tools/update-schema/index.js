const config = require('./config.json')

const fs = require('fs').promises

const { promisify } = require('util')

const execOld = promisify(require('child_process').exec)

const rimraf = promisify(require('rimraf'))

const requestOld = require('request')
const Octokit = require('@octokit/rest')

const path = require('path')

const SchemaParser = require('../tl-to-json/lib/Parser')

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
  const currentLayerNumber = parseInt(await fs.readFile("current_layer.txt"))

  console.log("Latest fetched layer number:", currentLayerNumber)

  const { body: schema } = await request(`https://raw.githubusercontent.com/telegramdesktop/tdesktop/dev/Telegram/Resources/scheme.tl?${Date.now()}`)

  const layerRegex = /\/\/ LAYER ([0-9]+)/g
  const newLayerNumber = parseInt(layerRegex.exec(schema)[1])

  console.log("New fetched layer number:", newLayerNumber)

  if(Number.isNaN(currentLayerNumber) || newLayerNumber > currentLayerNumber) {
    console.log("Current layer is NaN or new > current, starting PR process...")

    await rimraf(config.REPO_WORKING_DIRECTORY)

    console.log("Creating working directory if it does not already exist...")

    await fs.mkdir(config.REPO_WORKING_DIRECTORY)

    console.log("Deleting any existing forks, we won't need those...")

    await octokit.repos.delete({
      owner: "schemabot",
      repo: "schema.tl"
    })

    console.log("Forking tjhorner/schema.tl...")

    await octokit.repos.createFork({
      owner: "tjhorner",
      repo: "schema.tl"
    })

    console.log("Waiting 10 seconds to ensure the forking is done...")

    await wait(10000)

    console.log("Cloning repository...")

    await exec(`git clone --depth=1 git@github.com:schemabot/schema.tl.git ${config.REPO_WORKING_DIRECTORY}`)

    console.log(`Checking out new branch layer-${newLayerNumber}...`)

    await exec(`git checkout -b layer-${newLayerNumber}`, { cwd: config.REPO_WORKING_DIRECTORY })

    console.log("Converting new schema to JSON...")

    const parser = new SchemaParser()
    const newSchema = parser.parse(schema)

    console.log("Writing new schema to working directory...")

    await fs.writeFile(path.join(config.REPO_WORKING_DIRECTORY, "resources", "schema.json"), JSON.stringify(newSchema, null, 2))
    await fs.writeFile(path.join(config.REPO_WORKING_DIRECTORY, "resources", "schema.tl"), schema)

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

    await exec(`git add -A && git -c "user.signingkey=${config.GIT_SIGNING_KEY_ID}" -c "user.name=${config.GIT_NAME}" -c "user.email=${config.GIT_EMAIL}" commit -S --allow-empty -m "[chore] Update to layer ${newLayerNumber}"`, { cwd: config.REPO_WORKING_DIRECTORY, shell: "bash" })

    console.log("Pushing changes to GitHub...")

    await exec(`git push origin layer-${newLayerNumber}`, {
      cwd: config.REPO_WORKING_DIRECTORY,
      env: {
        GIT_SSH_COMMAND: `ssh -o IdentitiesOnly=yes -i ${config.GIT_PRIVATE_KEY_PATH}`
      }
    })

    console.log("OK, done! Cleaning up working directory...")

    await rimraf(config.REPO_WORKING_DIRECTORY)

    console.log("Working directory is cleaned. Submitting the PR...")

    const { data: pr } = await octokit.pulls.create({
      owner: "tjhorner",
      repo: "schema.tl",
      head: `schemabot:layer-${newLayerNumber}`,
      base: "master",
      title: `[chore] Update to layer ${newLayerNumber}`,
      body: `Hello! It's time... time to update the schema layer! This pull request migrates from layer ${currentLayerNumber} to layer ${newLayerNumber}. Please check to make sure I didn't screw anything up!\n\nWith ❤️,\nYour Friendly Neighborhood Schemabot`
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

    await fs.writeFile("current_layer.txt", newLayerNumber)

    console.log(`\nEverything is done! Updated layer ${currentLayerNumber} -> ${newLayerNumber}.`)
  } else {
    console.log("New layer is the same as current layer. Nothing to change! Bye")
  }
}

start()