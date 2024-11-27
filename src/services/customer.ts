import { CustomerService as medusaCustomerService } from "@medusajs/medusa";

class CustomerService extends medusaCustomerService {
  async getMessage() {
    const sthRepo = this.activeManager_.withRepository(
      this.customerRepository_
    );

    const sth = await sthRepo.findOne({
      where: {
        email: "d@gmail.com",
      },
    });

    console.log(
      sth,
      "this is the user with the workflow id ++++++++++++++++++++++++++++++++++"
    );
    return "hello world";
  }
}

export default CustomerService;
