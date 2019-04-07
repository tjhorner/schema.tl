class Parser {
  constructor() {
    this.methods = [ ]
    this.constructors = [ ]

    this._lines = [ ]
    this._line = 0
    this._state = 2
    // 0 = Nothing
    // 1 = Methods (functions)
    // 2 = Constructors (types)
  }

  static uintToInt(val) {
    if(val > 2147483647) return val - 4294967296
    return val
  }

  parse(text) {
    this._lines = text.split("\n")

    for(this._line = 0; this._line < this._lines.length; this._line++) {
      var line = this._lines[this._line]

      if(line.indexOf("//") === 0 || line.trim() === "") {
        continue
      } else if(line.indexOf("---functions---") === 0) {
        this._state = 1
        continue
      } else if(line.indexOf("---types---") === 0) {
        this._state = 2
        continue
      } else {
        const identifier = /([A-z0-9_\.]+)#([a-f0-9]+)/
        const parameter = /([A-z0-9_]+):([A-z0-9_\#\?\.<>]+)/g
        const returnType = /= (.+);/

        var ident = identifier.exec(line)
        var identParsed = {
          id: -Parser.uintToInt(~parseInt(ident[2], 16) + 1 >>> 0), // parseInt(ident[2], 16),
          name: ident[1]
        }

        var parameters = [ ]
        var lastMatch
        while((lastMatch = parameter.exec(line)) !== null) {
          parameters.push({
            name: lastMatch[1],
            type: lastMatch[2]
          })
        }

        var resultType = returnType.exec(line)[1]

        if(this._state === 1) {
          this.methods.push({
            id: identParsed.id.toString(),
            method: identParsed.name,
            params: parameters,
            type: resultType
          })
        } else if(this._state === 2) {
          this.constructors.push({
            id: identParsed.id.toString(),
            predicate: identParsed.name,
            params: parameters,
            type: resultType
          })
        } else {
          throw new Error("Invalid state!")
        }
        continue
      }
    }

    return {
      methods: this.methods,
      constructors: this.constructors
    }
  }
}

module.exports = Parser