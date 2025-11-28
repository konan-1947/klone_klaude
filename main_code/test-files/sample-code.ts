const greeting = "Hello from JavaScript!";

function sayHello(name) {
    return `${greeting} Welcome, ${name}!`;
}

console.log(sayHello("Test User"));

export { sayHello };
