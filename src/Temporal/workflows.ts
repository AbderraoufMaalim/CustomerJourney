// @@@SNIPSTART typescript-hello-workflow
import { Workflow, proxyActivities, sleep } from "@temporalio/workflow";
import { setHandler } from "@temporalio/workflow";
import * as wf from "@temporalio/workflow";

// Only import the activity types
import * as activities from "./activities";
import {
  JoinInput,
  productRecommendationSignal,
  SocketId,
  socketChangedSignal,
  OrderPlaced,
  orderPlacedSignal,
} from "./signal";

const {
  inviteTosubscribe,
  recommendProducts,
  recommendProductsWithLowerPrice,
  checkOrderPlaced,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
});

/** A workflow that simply calls an activity */
export async function firstConnectionWorkflow(
  name: string,
  socket: any
): Promise<string> {
  let STEP = "desire";
  let socketId = socket;
  await sleep("10 seconds");
  setHandler(socketChangedSignal, async ({ changedSocketId }: SocketId) => {
    socketId = changedSocketId;
  });

  await inviteTosubscribe(name, socketId);

  let emailSent = false;
  let didBuy = false;

  let recommendedProducts: { id: string }[];
  let recommendedProductsWithLowerPrice: { id: string }[];
  STEP = "intention";

  let workflowProps: JoinInput = {
    targetedProduct: null,
    productType: null,
    email: null,
  };

  setHandler(
    productRecommendationSignal,
    async ({ targetedProduct, productType, email }: JoinInput) => {
      workflowProps.targetedProduct = targetedProduct;
      workflowProps.productType = productType;
      workflowProps.email = email;
      recommendedProducts = await recommendProducts(workflowProps);
      emailSent = true;
      STEP = "trying";
    }
  );
  await wf.condition(() => emailSent === true, "2 minutes");

  setHandler(orderPlacedSignal, async ({ cartId }: OrderPlaced) => {
    didBuy = await checkOrderPlaced(cartId, recommendedProducts);

    if (didBuy) {
      STEP = "purchase";
    }
  });

  if (emailSent) {
    await sleep("1 minutes");

    if (!didBuy) {
      recommendedProductsWithLowerPrice = await recommendProductsWithLowerPrice(
        workflowProps
      );

      recommendedProducts = recommendedProducts.concat(
        recommendedProductsWithLowerPrice
      );
    }

    await wf.condition(() => didBuy === true, "2 hours");
  }

  return " ";
}
// @@@SNIPEND
