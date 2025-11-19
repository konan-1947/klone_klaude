function calculateTotal(items) {
    var total = 0;
    for (let item of items) {
        total += item.price;
    }
    return total;
}

function greetUser(name) {
    console.log("Hello, " + name);
}
