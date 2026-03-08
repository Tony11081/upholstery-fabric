const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({take:5,select:{slug:true,titleEn:true}})
  .then(r=>console.log(JSON.stringify(r,null,2)))
  .finally(()=>p.$disconnect());
