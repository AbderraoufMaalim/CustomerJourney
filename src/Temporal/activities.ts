// @@@SNIPSTART typescript-hello-activity
import nodemailer from "nodemailer";
import { JoinInput } from "./signal";

import { dataSource } from "@medusajs/medusa/dist/loaders/database";
import { Customer } from "@medusajs/medusa";
import { Product } from "@medusajs/medusa";
import { ProductCollection } from "@medusajs/medusa";
import { ProductVariantMoneyAmount } from "@medusajs/medusa";
import { Collection, IsNull, Not } from "typeorm";
import { MoneyAmount } from "@medusajs/medusa";
import { ProductVariant } from "@medusajs/medusa";
import { LineItem } from "@medusajs/medusa";

let io;
export function set_io(socketio) {
  io = socketio;
}
export async function inviteTosubscribe(
  name: string,
  socket: any
): Promise<string> {
  io.to(socket).emit("inviteTosubscribe");
  return `Hello , ${socket}!`;
}
async function sendMail({
  targetedProduct,
  productType,
  email,
  products,
}: {
  targetedProduct: string | null;
  productType: string | null;
  email: string | null;
  products: any | null;
}) {
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "graristar@gmail.com",
      pass: "mitbjwkedortxewp",
    },
  });

  var mailOptions = {
    from: "graristar@gmail.com",
    to: email,
    subject: "We have recommended Products for you",
    // text: `Recommended Products :
    //       ${products.map((product) => {return product.title})}
    // `,
    html: `
    <h1>Bonjour,</h1>

      <p>Merci d'avoir choisi notre site pour votre recherche de vélos. Voici quelques recommandations basées sur la catégorie que vous avez sélectionnée :</p>

    ${products.map((product) => {
      return `<a href='http://localhost:8080/us/products/${product.handle}'>${product.title}</a>`;
    })}


    <p>Si vous avez des questions, n'hésitez pas à nous contacter</p>.

    <p>Cordialement,</p>
    <p>L'équipe de vente de vélos</p>`,
  };

  await transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}
export async function recommendProducts({
  targetedProduct,
  productType,
  email,
}: JoinInput): Promise<{ id: string }[]> {
  const collectionRepo = dataSource.getRepository(ProductCollection);
  const productRepo = dataSource.getRepository(Product);
  let collecitonId;
  if (targetedProduct === "BIKE") {
    collecitonId = await collectionRepo.findOne({
      where: {
        title: productType,
      },
    });
  } else {
    collecitonId = await collectionRepo.findOne({
      where: {
        title: targetedProduct,
      },
    });
  }

  const products = await productRepo.find({
    where: {
      collection_id: collecitonId.id,
    },
    take: 4,
  });

  await sendMail({ targetedProduct, productType, email, products });
  return products.map((product) => {
    return { id: product.id };
  });
}

export async function recommendProductsWithLowerPrice({
  targetedProduct,
  productType,
  email,
}: JoinInput): Promise<{ id: string }[]> {
  const collectionRepo = dataSource.getRepository(ProductCollection);
  const productRepo = dataSource.getRepository(Product);
  const productVariantRepo = dataSource.getRepository(ProductVariant);
  const productVariantMoneyAmountRepo = dataSource.getRepository(
    ProductVariantMoneyAmount
  );
  const moneyAmountRepo = dataSource.getRepository(MoneyAmount);

  let collecitonId;
  if (targetedProduct === "BIKE") {
    collecitonId = await collectionRepo.findOne({
      where: {
        title: productType,
      },
    });
  } else {
    collecitonId = await collectionRepo.findOne({
      where: {
        title: targetedProduct,
      },
    });
  }

  const products = await productRepo.find({
    where: {
      collection_id: collecitonId.id,
    },
  });

  const productsVariants = await Promise.all(
    products.map(async (product) => {
      const variants = await productVariantRepo.find({
        where: {
          product_id: product.id,
        },
      });
      return {
        ...product,
        variants: variants.map((varinat) => {
          return { id: varinat.id };
        }),
      };
    })
  );

  const productsVariantPrice = await Promise.all(
    productsVariants.map(async (product) => {
      return {
        ...product,
        variants: await Promise.all(
          product.variants.map(async (variant) => {
            return {
              id: variant.id,
              pricesId: await productVariantMoneyAmountRepo.find({
                where: {
                  variant_id: variant.id,
                },
              }),
            };
          })
        ),
      };
    })
  );

  const p = await Promise.all(
    productsVariantPrice.map(async (product) => {
      return {
        ...product,
        variants: await Promise.all(
          product.variants.map(async (variant) => {
            return {
              id: variant.id,
              prices: await Promise.all(
                variant.pricesId.map(async (priceId) => {
                  const price = await moneyAmountRepo.findOneBy({
                    id: priceId.money_amount_id,
                  });

                  return {
                    amount: price.amount,
                    currency: price.currency_code,
                  };
                })
              ),
            };
          })
        ),
      };
    })
  );

  const sortedProducts = p
    .map((product) => {
      return {
        ...product,
        variants: product.variants
          .map((variant) => {
            return {
              id: variant.id,
              price: variant.prices.filter(
                (price) => price.currency === "eur"
              )[0].amount,
            };
          })
          .sort((a, b) => b.price - a.price),
      };
    })
    .sort((a, b) => a.variants[0].price - b.variants[0].price);

  await sendMail({
    targetedProduct,
    productType,
    email,
    products: sortedProducts.slice(0, 4),
  });

  return sortedProducts.slice(0, 4).map((product) => {
    return { id: product.id };
  });
}

export async function checkOrderPlaced(
  cartId: string,
  recommendedProducts: { id: string }[]
): Promise<boolean> {
  const lineItemRepo = dataSource.getRepository(LineItem);
  const productVariantRepo = dataSource.getRepository(ProductVariant);

  const placedOrder = await lineItemRepo.find({
    where: {
      cart_id: cartId,
      order_id: Not(IsNull()),
    },
  });

  const orderedProducts = await await Promise.all(
    placedOrder.map(async (variant) => {
      const productVariant = await productVariantRepo.findOneBy({
        id: variant.variant_id,
      });
      return productVariant.product_id;
    })
  );

  return orderedProducts.some((orderedProductId) => {
    return recommendedProducts.some(
      (recommendedProduct) => recommendedProduct.id === orderedProductId
    );
  });
}

// @@@SNIPEND
