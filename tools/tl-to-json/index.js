const fs = require('fs')
const Parser = require('./lib/Parser')

const schema = fs.readFileSync("./schema.tl").toString()

const parser = new Parser()

fs.writeFileSync("schema.json", JSON.stringify(parser.parse(schema), null, 2))