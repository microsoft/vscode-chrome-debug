# TypeScript style guide

This guide optimizes for readability and maintainability over performance. It includes style conventions and some TypeScript best practices.

Tslint
-------

Run `gulp tslint` before committing to check your code against the rules that are enabled for this repo. But not everything can be checked with tslint, so read this guide, too.

Types
-----

Whenever possible, use types instead of the any type. Use type inference freely. Add type information when the inference is not clear. Specify function's return type if it's not clear from the implemetation.

```TypeScript
// myDocument type is not obvious to the reader
getFromDatabase.done((myDocument: DocumentType) => {
    response(myDocument);
});

// Type of streetAddress is clear
const streetAddress = "221B Baker Street";
```

Use `number[]` over `Array<number>`.

Use `const` whenever possible, and avoid needlessly reusing or reassigning variables. Use `let` when needed.

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

Don't combine multiple var, let or const statements together. Use `'` for strings, `" or \`` for strings within strings.

```TypeScript
import foo from "foo";
const subFoo = foo.subFoo;
```

Declare a variable before referencing it (e.g. declare variables in the correct order).

Don't use leading or trailing commas.

Add a space after the colon `:` character, but not before it.

```TypeScript
let myVariable: string;
```

Very long lines should be broken up into multiple lines.

Naming
------

Abbreviations should almost never be used, but also avoid overtly long names. Common abbreviations like URL are ok. Use [camelCase](http://en.wikipedia.org/wiki/CamelCase) for variables and properties. Use PascalCase for classes, types and constructor functions. Interfaces should start with the letter I.

Single letter names should only be used when the domain calls for it, e.g. for-loop counters or mathematics. Names may include special characters (e.g. ε) if the domain calls for it.

Comments
--------

Strike a balance between commenting too much and attempting to write "self-documenting" code. Most comments should explain why instead of what, but sometimes it's necessary to explain what with comments.

Leave a space before the comment text. Add comment to a line before the code.

```TypeScript
// Formula proven by Archimedes
const area = π * r * r;
```

When documenting a function, use [JSDoc](http://usejsdoc.org/).

```TypeScript
// Good

/**
 * Returns a promise of the latest revision of the document with the specified id.
 * @param id of the document
 */
private getLatestDocument(id: string): Promise<IDocument> {
    // ... implementation here
}

// Bad

// Returns a promise of the latest revision of the document with the specified id.
private getLatestDocument(id: string): Promise<IDocument> {
    // ... implementation here
}
```

When passing a primitive literal to a function, annotate it inline with the parameter name, if it's not obvious from context.

```TypeScript
addItem(item, /*forceRefresh=*/true);
```

Control structures
------------------

Use functional style .forEach, .map, .filter etc. over for/while loops whenever possible.

```TypeScript
commands
    .filter(isAuthorizedCommand)
    .forEach(executeCommand);
```

When iterating over the keys of an object, use forEach and Object.keys over `for..in`.

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

Use the fat arrow notation `=>` over the function keyword. Leave out the ()-braces if there is only one function parameter with an inferred type. Don't use curly braces if the function is simple and immediately returns a value. Add a space before and after `=>`.

```TypeScript
const squaredValues = values.map(value => value * value);

const printValues = (values: number[]) => {
    console.log(JSON.stringify(values));
};
```

Use `that` when referring to another `this`. Note that this is often not necessary when the fat-arrow syntax is not used.

Comparison
----------

Always use the strict equality comparision `===` and `!==` over `==` and `!=`, unless comparing to null, to avoid checking both null and undefined.

```TypeScript
// Bad
if (newValue == oldValue) {
}

// Good
if (newValue === oldValue) {
}

// Good
if (newValue == null) {
}
```

Use implicit boolean type coercion only for checking truthiness.

Further reading, inspiration and sources
----------------------------------------

This guide was forked from https://github.com/panuhorsmalahti/typescript-style-guide

1. https://github.com/airbnb/javascript/blob/master/README.md
2. http://www.jslint.com/
3. https://github.com/Platypi/style_typescript
4. https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines