const clientIo = io("http://localhost:3000/");
const clientIo2 = io("http://localhost:3000/admin");

clientIo.on("connect", () => {
  console.log(`Server stablish connection successfully ❤`);
});
