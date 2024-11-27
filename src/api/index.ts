import { registerOverriddenValidators } from "@medusajs/medusa";
import { StorePostCustomersReq as MedusaStorePostCustomersReq } from "@medusajs/medusa";
import { IsString } from "class-validator";

class StorePostCustomersReq extends MedusaStorePostCustomersReq {
  @IsString()
  workflowId: string;
}

registerOverriddenValidators(StorePostCustomersReq);
