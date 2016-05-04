# TypeScript style guide

This guide optimizes for readability and maintainability over performance. It includes style conventions and some TypeScript best practices.

General
-------

Use [TSLint](https://www.npmjs.com/package/tslint) in your build process to enforce the style. Write ES6 with strict mode and compile to your target using e.g. [babel](https://github.com/babel/babel).

Types
-----

Enable noImplicitAny option the compiler. Use types instead of the any type. Use type inference freely. Add type information when the inference is not clear. Specify function's return type if it's not clear from the implemetation.

```TypeScript
// myDocument type is not obvious to the reader
getFromDatabase.done((myDocument: DocumentType) => {
    response(myDocument);
});

// Type of streetAddress is clear
const streetAddress = "221B Baker Street";
```

Convert types with global objects instead of shorthands (``String(foo)`` over ``'' + foo``). Add types to a module instead of polluting the global namespace with every interface.

Use ``number[]`` over ``Array<number>``.

Use ``let`` over ``var`` to have better scoping. Use ``const`` for variables which are not re-assigned.

Formatting
----------

Indent with 4 spaces. Always use curly braces and add semicolons. Add a new line for each property in an object. Use the literal syntax of objects, arrays and regular expressions. Use the dot notation for property access. Remove whitespace at the end of lines (including empty lines). End the file with a newline character. Don't have consecutive empty lines.

```TypeScript
let myObject = {
    foo: bar
};
```

Separate operators and variables with spaces unless it's an unary operator. Add a space before an opening curly brace.

```TypeScript
let area = length * width;
```

Don't combine multiple var, let or const statements together. Use ``"`` for strings, ``'`` for strings within strings.

```TypeScript
import foo from "foo";
const subFoo = foo.subFoo;
```

Declare a variable before referencing it (e.g. declare variables in the correct order).

Don't use leading or trailing commas.

Add a space after the colon ``:`` character, but not before it.

```TypeScript
let myVariable: string;
```

Lines should be at most 140 characters long.

Naming
------

Use [domain-driven](http://en.wikipedia.org/wiki/Domain-driven_design) naming. Abbrevations should almost never be used, but also avoid overtly long names. Use [camelCase](http://en.wikipedia.org/wiki/CamelCase) for variables and properties. Use PascalCase for classes, types and constructor functions. Don't start interfaces with the letter I.

Single letter names should only be used when the domain calls for it, e.g. mathematics. Names may include special characters (e.g. ε) if the domain calls for it.

Comments
--------

Strike a balance between commenting too much and attempting to write "self-documenting" code. Most comments should explain why instead of what, but sometimes it's necessary to explain what with comments.

Leave a space before the comment text and start with a capital letter unless the first word is a variable. Add comment to a line before the code.

```TypeScript
// Formula proven by Archimedes
const area = π * r * r;
```

Use [JSDoc](http://usejsdoc.org/) for documenting all named functions.

```TypeScript
/**
 * Returns a promise of the latest revision of the document with the specified id.
 * @param {string} id of the document
 * @returns {Q.Promise<DocumentType>}
 */
const getLatestDocument = (id: string) => {
    // ... implementation here
};
```

Use ``// FIXME: `` and ``// TODO: `` tags and set your build server to track them.

```TypeScript
// FIXME: Handle error case
// TODO: Implement caching
```

Control structures
------------------

Use functional style .forEach, .map, .filter etc. over for/while loops whenever possible. When a for/while loop is required for performance reasons leave a comment stating so.

```TypeScript
// Authorization is required since commands include all commands.
commands.filter(authorizedCommand).forEach(executeCommand);
```

Use forEach and Object.prototype.keys over ``for..in``.

Place else in the same line as the ending curly brace, always use curly braces and add whitespace after the if keyword.

```TypeScript
if (isAuthorized) {
    response();
} else {
    // Not authorized..
}
```

Functions
---------

Use the fat arrow notation ``=>`` over the function keyword. Leave out the ()-braces if there is only one function parameter with an inferred type. Don't use curly braces if the function is simple and immediately returns a value. Add a space before and after ``=>``.

```TypeScript
const squaredValues = values.map(value => value * value);

const printValues = (values: number[]) => {
    console.log(JSON.stringify(values));
};
```

Use ``that`` when referring to another ``this``. Note that this is often not necessary when the fat-arrow syntax is not used.

Comparison
----------

Always use the strict equality comparision ``===`` and ``!==`` over ``==`` and ``!=``. Use implicit boolean type coercion only for checking truthiness.

Further reading, inspiration and sources
----------------------------------------

This guide was forked from https://github.com/panuhorsmalahti/typescript-style-guide

1. https://github.com/airbnb/javascript/blob/master/README.md
2. http://www.jslint.com/
3. https://github.com/Platypi/style_typescript
4. https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines