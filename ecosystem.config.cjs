module.exports = {
  apps: [
    {
      name: "carpool-connect-server",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
