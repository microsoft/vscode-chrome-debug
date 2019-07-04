const fs = require('fs');

// update name, publisher, and description
const json = JSON.parse(fs.readFileSync('./package.json').toString());

// calculate version
const date = new Date();
const monthMinutes = (date.getDate() - 1) * 24 * 60 + date.getHours() * 60 + date.getMinutes();
const version = `${date.getFullYear()}.${date.getMonth() + 1}.${monthMinutes}`;

const jsonMixin = JSON.parse(fs.readFileSync('./package.nightly.json').toString());

const nightlyPackageJson = {
    ...json,
    ...jsonMixin,
    ...{
        version
    }
};

console.log('Rewritten attributes: ');
console.log('  name: ' + nightlyPackageJson.name);
console.log('  version: ' + nightlyPackageJson.version);
console.log('  displayName: ' + nightlyPackageJson.displayName);
console.log('  description: ' + nightlyPackageJson.description);

fs.writeFileSync('./package.json', JSON.stringify(nightlyPackageJson));
