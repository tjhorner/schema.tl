// this file generates empty markdown files, lol
var fs = require('fs'),
    schema = require('./resources/schema.json')

schema.constructors.forEach(constr => {
  fs.appendFileSync(__dirname + "/docs/constructors/" + constr.predicate + ".md", "")
})

schema.methods.forEach(method => {
  fs.appendFileSync(__dirname + "/docs/methods/" + method.method + ".md", "")
})