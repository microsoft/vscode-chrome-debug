// From http://blog.modulus.io/build-your-first-http-server-in-nodejs
console.log('hello!');

//Lets require/import the HTTP module
var http = require('http');

//Lets define a port we want to listen to
var PORT = 8080;

//We need a function which handles requests and send response
function handleRequest(request, response) {
    response.end('It Works!! Path Hit: ' + request.url);
}

//Create a server
var server = http.createServer(handleRequest);

//Lets start our server
server.listen(PORT, function() {
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Server listening on: http://localhost:%s", PORT);
});

function fn() {
    console.log("I'm alive!");
    anotherFn();
}

function anotherFn() {
    var asdf = 123;
    var someObject = { prop1: "apples", prop2: "bananas" };
}

setInterval(fn, 2000);