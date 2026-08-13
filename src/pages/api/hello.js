// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import db from '@/pages/api/config/connectDB';
import dbPrisma from '@/pages/api/config/connectDbPrisma';
import defaultResponse from '@/pages/api/config/defaultResponse';

const handler = async (req, res) => {
  try {
    const connected = await db.connect();
    
    if(!connected){
      return res.status(400).json(defaultResponse('Erro de conexão com o banco de dados'));
    }
    
    connected.release();
    
    await dbPrisma.$queryRaw`SELECT 1`;

    res.status(200).json(defaultResponse("The API os ok :)"));
  } catch (error) {
    console.error(error);
    return res.status(500).json(defaultResponse());
  }
}


export default handler;