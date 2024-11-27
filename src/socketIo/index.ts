import { dataSource } from "@medusajs/medusa/dist/loaders/database";
import { Customer } from "@medusajs/medusa";
import { Client } from "@temporalio/client";
import { nanoid } from "nanoid";
import { Socket } from "socket.io";
import { firstConnectionWorkflow } from "../Temporal/workflows";
import { socketChangedSignal, orderPlacedSignal } from "../Temporal/signal";

export async function checkWorkflowId(
  payload: string,
  client: Client,
  socket: Socket
) {
  if (!payload) {
    const workflowId = "workflow-" + nanoid();
    socket.emit("set-workflow-id", { workflowId });

    try {
      const handle = await client.workflow.start(firstConnectionWorkflow, {
        taskQueue: "hello-world",
        args: ["Temporals", socket.id],
        workflowId: workflowId,
      });
      console.log(`Started workflow ${handle.workflowId}`);
      return handle;
    } catch (error) {
      console.log({ error });
    }
  } else {
    let p;
    try {
      p = await client.workflowService.getWorkflowExecutionHistoryReverse({
        namespace: "default",
        execution: {
          workflowId: payload,
        },
      });
    } catch (error) {
      console.log("hna6");
      console.log(error);
    }

    if (p && !p.history.events[0].workflowExecutionCompletedEventAttributes) {
      try {
        const handle = await client.workflow.getHandle(payload);
        handle.signal(socketChangedSignal, {
          changedSocketId: socket.id,
        });
        return handle;
      } catch (e) {
        console.log(e);
      }
    } else {
      const workflowId = "workflow-" + nanoid();
      socket.emit("set-workflow-id", { workflowId });

      try {
        const handle = await client.workflow.start(firstConnectionWorkflow, {
          taskQueue: "hello-world",
          args: ["Temporals", socket.id],
          workflowId: workflowId,
        });
        console.log(`Started workflow2  ${handle.workflowId}`);
        return handle;
      } catch (error) {
        console.log(error);
      }
    }
    //   } else
  }
}

export async function getCustomerWorkflowId(
  email: string,
  client: Client,
  socket: Socket
) {
  let customerWorkflowId;
  let customer: Customer;
  const CustomerRepository = dataSource.getRepository(Customer);
  try {
    customer = await CustomerRepository.findOne({
      where: {
        email: email,
      },
    });

    customerWorkflowId = customer.workflowId;
  } catch (error) {
    console.log(error);
  }

  if (customerWorkflowId) {
    let workflowHistory;
    try {
      workflowHistory =
        await client.workflowService.getWorkflowExecutionHistoryReverse({
          namespace: "default",
          execution: {
            workflowId: customerWorkflowId,
          },
        });
    } catch (error) {
      console.log(error);
    }

    if (
      workflowHistory &&
      !workflowHistory.history.events[0]
        .workflowExecutionCompletedEventAttributes
    ) {
      try {
        const handle = await client.workflow.getHandle(customerWorkflowId);
        handle.signal(socketChangedSignal, {
          changedSocketId: socket.id,
        });

        socket.emit("set-workflow-id", {
          workflowId: customerWorkflowId,
        });
        //
        return handle;
      } catch (error) {
        console.log(error);
      }
    } else {
      customerWorkflowId = "workflow-" + nanoid();
      socket.emit("set-workflow-id", { workflowId: customerWorkflowId });

      try {
        const handle = await client.workflow.start(firstConnectionWorkflow, {
          taskQueue: "hello-world",
          args: ["Temporals", socket.id],
          workflowId: customerWorkflowId,
        });
        console.log(`Started workflow  ${handle.workflowId}`);
        customer.workflowId = customerWorkflowId;
        await CustomerRepository.save(customer);
        return handle;
      } catch (error) {
        console.log(error);
      }
    }
  } else {
    customerWorkflowId = "workflow-" + nanoid();
    socket.emit("set-workflow-id", { workflowId: customerWorkflowId });

    try {
      const handle = await client.workflow.start(firstConnectionWorkflow, {
        taskQueue: "hello-world",
        args: ["Temporals", socket.id],
        workflowId: customerWorkflowId,
      });
      console.log(`Started workflow  ${handle.workflowId}`);
      customer.workflowId = customerWorkflowId;
      await CustomerRepository.save(customer);
      return handle;
    } catch (error) {
      console.log(error);
    }
  }

  socket.emit("set-workflow-id", {
    workflowId: customerWorkflowId,
  });

  const handle = await client.workflow.getHandle(customerWorkflowId);
  return handle;
}

export async function getNewWorkflowId(socket: Socket, client: Client) {
  const workflowId = "workflow-" + nanoid();
  socket.emit("set-workflow-id", { workflowId });

  try {
    const handle = await client.workflow.start(firstConnectionWorkflow, {
      taskQueue: "hello-world",
      // type inference works! args: [name: string]
      args: ["Temporals", socket.id],
      // in practice, use a meaningful business ID, like customerId or transactionId
      workflowId: workflowId,
      //workflowId: "workflow-" + nanoid(),
    });
    console.log(`Started workflow ${handle.workflowId}`);
    return handle;
  } catch (error) {
    console.log(error);
  }
}

export async function orderPlaced(cartId, workflowId, client) {
  try {
    const handle = await client.workflow.getHandle(workflowId);
    handle.signal(orderPlacedSignal, {
      cartId,
    });
    return handle;
  } catch (e) {
    console.log(e);
  }
}
