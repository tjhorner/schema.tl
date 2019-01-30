# [TL-Schema Explorer](https://schema.horner.tj)

An AngularJS app to search and view the Telegram API TL-schema in a beautiful way.

![](https://i.imgur.com/akrelfR.png)

## Features

- Search and view TL-schema constructors, types, and methods
- Community-driven documentation
- Easy testing of constructors and methods with the playground
- Easy access to `schema.json` and `schema.tl`
- Always up-to-date

### Search

Search is blazing fast since everything is local.

![](https://user-images.githubusercontent.com/2646487/52002101-eef02580-2475-11e9-8277-b80f118f87dd.png)

### Playground

You can use the playground on constructor and method pages to easily test the API with [Telegram for Devs](https://tjhorner.com/webogram).

![](https://user-images.githubusercontent.com/2646487/52001701-ea773d00-2474-11e9-8806-397278cb4387.png)

### Updating the Schema

If you find that the schema is out-of-date (check [here](https://github.com/zhukov/webogram/blob/master/app/js/lib/config.js)), you can submit a PR if I don't update it in a timely manner (I don't monitor it 24/7!):

1. Update the `SCHEMA_GLOBAL` and `LAYER_NUMBER` in [`js/schema.js`](https://github.com/tjhorner/schema.tl/blob/master/js/schema.js).
2. Replace [`resources/schema.json`](https://github.com/tjhorner/schema.tl/blob/master/resources/schema.json) with the current schema in JSON format (prettify it, pretty please).
3. Replace [`resources/schema.tl`](https://github.com/tjhorner/schema.tl/blob/master/resources/schema.tl) with the current schema in Type-Language format.
4. Update the layer number in [`index.html`](https://github.com/tjhorner/schema.tl/blob/master/index.html).

That's it. Submit your PR and I'll accept it ASAP.

### Documentation

Anyone in the community can add documentation to constructors or methods. To do so, click the "Help document this method" button, make your changes, and submit a pull request. Simple as that!

![](https://i.imgur.com/9vcRYxy.png)