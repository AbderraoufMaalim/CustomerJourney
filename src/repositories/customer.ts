import { dataSource } from "@medusajs/medusa/dist/loaders/database";
import { Customer } from "../models/customer";

const CustomerRepository = dataSource.getRepository(Customer);

export default CustomerRepository;
