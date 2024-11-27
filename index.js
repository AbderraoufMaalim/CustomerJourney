const express = require("express");
const { GracefulShutdownServer } = require("medusa-core-utils");
const { Server } = require("socket.io");
const { NativeConnection, Worker } = require("@temporalio/worker");
const { Connection, Client, WorkflowClient } = require("@temporalio/client");
const activities = require("./dist/temporal/activities");

const socketIoService = require("./dist/socketIo/index");

// const CustomerRepository = require("./dist/repositories/customer");
// const {
//   default: CustomerRepository,
// } = require("@medusajs/medusa/dist/repositories/customer");
// const CustomerRepository = require("@medusajs/medusa/dist/repositories/customer");

const loaders = require("@medusajs/medusa/dist/loaders/index").default;

(async () => {
  async function start() {
    const app = express();
    const directory = process.cwd();

    try {
      const { container } = await loaders({
        directory,
        expressApp: app,
      });
      const configModule = container.resolve("configModule");
      const port = process.env.PORT ?? configModule.projectConfig.port ?? 9000;

      const server = GracefulShutdownServer.create(
        app.listen(port, async (err) => {
          if (err) {
            return;
          }
          console.log(`Server is ready on port: ${port}`);
        })
      );

      const io = new Server(server, {
        cors: {
          origin: "*",
        },
      });

      activities.set_io(io);

      const clientConnection = await Connection.connect({
        address: "127.0.0.1:7233",
      });
      const client = new Client({
        clientConnection,
      });

      io.on("connection", async (socket) => {
        let handle;
        // console.log(dataSource, "this is data source");
        // console.log(Customer, "this is customer");

        // const CustomerRepository = dataSource.getRepository(Customer);

        console.log("A user has connected");

        socket.on("check-workflow-id", async (payload) => {
          // console.log(payload,'null here ?')
          // try {
          //   const p =
          //     await client.workflowService.getWorkflowExecutionHistoryReverse({
          //       namespace: "default",
          //       execution: {
          //         workflowId: "workflow-J0Lik4ZQtMe0PfQSQoF5_",
          //       },
          //     });

          //   if (p.history.events[0].workflowExecutionCompletedEventAttributes) {
          //     console.log("yesssssssssssssssssssssssssssssssssss");
          //   } else {
          //     console.log("nopooooooooooooooooooooooooooooooo");
          //   }
          // } catch (error) {
          //   console.log(error);
          // }
          // if (!payload) {
          //   const workflowId = "workflow-" + nanoid();
          //   socket.emit("set-workflow-id", { workflowId });

          handle = socketIoService.checkWorkflowId(payload, client, socket);
        });

        socket.on("get-customer-workflow-id", async (payload) => {
          handle = socketIoService.getCustomerWorkflowId(
            payload.email,
            client,
            socket
          );
        });

        socket.on("get-new-workflow-id", async () => {
          handle = socketIoService.getNewWorkflowId(socket, client);
        });

        socket.on("order-placed", async (payload) => {
          handle = socketIoService.orderPlaced(
            payload.cartId,
            payload.workflowId,
            client
          );
        });
      });

      try {
        const connection = await NativeConnection.connect({
          address: "127.0.0.1:7233",
          // TLS and gRPC metadata configuration goes here.
        });
        // Step 2: Register Workflows and Activities with the Worker.
        const worker = await Worker.create({
          connection,
          namespace: "default",
          taskQueue: "hello-world",
          // Workflows are registered using a path as they run in a separate JS context.
          workflowsPath: require.resolve("./dist/temporal/workflows"),
          activities,
        });

        await worker.run();
      } catch (e) {
        console.log(e);
      }

      // Handle graceful shutdown
      const gracefulShutDown = () => {
        server
          .shutdown()
          .then(() => {
            console.info("Gracefully stopping the server.");
            process.exit(0);
          })
          .catch((e) => {
            console.error("Error received when shutting down the server.", e);
            process.exit(1);
          });
      };
      process.on("SIGTERM", gracefulShutDown);
      process.on("SIGINT", gracefulShutDown);
    } catch (err) {
      console.error("Error starting server", err);
      process.exit(1);
    }
  }

  await start();
})();
