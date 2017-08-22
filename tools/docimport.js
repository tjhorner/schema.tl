// imports documentation from https://core.telegram.org/schema
var request = require('request'),
    fs = require('fs'),
    cheerio = require('cheerio'),
    schema = require('../resources/schema.json')

schema.constructors.forEach(constructor => {
  request(`https://core.telegram.org/constructor/${constructor.predicate}`, (err, res, body) => {
    var $ = cheerio.load(body)
    var docs = $("#dev_page_content").find("p").first().text().trim()

    if(docs !== "")
      fs.appendFileSync(`../docs/constructors/${constructor.predicate}.md`, docs)
  })
})