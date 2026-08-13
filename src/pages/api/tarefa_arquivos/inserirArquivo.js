// DB
import db from '@/pages/api/config/connectDB';
import buildInsert from '@/pages/api/utils/buildInsert';

// Js
import axios from 'axios';

// Utils
import parseForm from '@/pages/api/utils/parseForm';
import readFileAsync from '@/pages/api/utils/readFileAsync';
import maxSize from '@/pages/api/utils/maxSize';
import defaultResponse from '@/pages/api/config/defaultResponse';
import buildImgSrc from '@/pages/api/utils/buildImgSrc';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
    name: 'QUADRO',
    escrita: true,
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req, res) => {
    try {       
        const maxSizeMb = 22;
        const maxSizeByte = maxSize(maxSizeMb); // 22MB
        const extensoesPermitidas = ['pdf', 'jpg', 'png', 'jpeg'];

        // Extraindo dados
        const { fields, files } = await parseForm(req);
        const arquivo = Array.isArray(files?.arquivo) ? files.arquivo[0] : files?.arquivo;
        const idTarefa = Array.isArray(fields?.id_tarefa) ? fields.id_tarefa[0] : fields?.id_tarefa;

        // Validando dados
        if (!arquivo) {
            return res.status(400).json(defaultResponse('Nenhum arquivo foi enviado'));
        }
        if (!idTarefa){
            return res.status(400).json(defaultResponse('Informe a tarefa!'));
        }

        const tarefa = await db.query({ text: 'SELECT id, id_espaco FROM tarefa WHERE id = $1', values: [idTarefa]});

        if (!tarefa || tarefa.rowCount !== 1){
            return res.status(404).json(defaultResponse('Tarefa não encontrada!'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: tarefa.rows[0].id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: db
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para inserir arquivos nesta tarefa!'));
        }

        // Validando tamanho do arquivo
        const fileBuffer = await readFileAsync(arquivo.filepath);
        if (fileBuffer.length > maxSizeByte) {
            return res.status(400).json(defaultResponse(`Arquivo deve ter no máximo ${maxSizeMb} MB`));
        }

        // Validando tipo do arquivo
        const extensao = arquivo.originalFilename.split('.').pop();
        if (!extensoesPermitidas.includes(extensao)) {
            return res.status(400).json(defaultResponse(`Extensões permitidas: ${extensoesPermitidas.join(', ')}`));
        }

        let response;

        // Publicando foto
        try {
            const url = `${process.env.OPERA_LINK}/files`;
            response = await axios.post(url, fileBuffer, {
                headers: {
                    authorization: process.env.OPERA_API_KEY,
                    'Content-Type': 'application/octet-stream',
                    'x-file-extension': extensao,
                    'x-folder-id': process.env.OPERA_FOLDER_ID
                },
            });
        } catch (error) {
            console.error('Erro ao salvar arquivo no Opera', error?.response ?? error);
            return res.status(500).json(defaultResponse('Erro ao salvar arquivo internamente. Contate o suporte!'));
        }

        // Inserindo no BD
        const tarefaArquivoData = {
            id_tarefa: idTarefa,
            id_opera: response.data.content.id,
            nome: arquivo.originalFilename,
            public_url: response.data.content.public_url
        };
        const tarefaArquivoInsert = buildInsert('tarefa_arquivo',tarefaArquivoData);
        const result = await db.query({ text: tarefaArquivoInsert.text, values: tarefaArquivoInsert.values });

        if (!result){
            return res.status(400).json(defaultResponse('Erro ao salvar arquivo no banco de dados!'));
        }

        const tarefaArquivo = result.rows[0];

        const dadosNaoEnviados = ['public_url'];
        const returnObj = {};

        for(const key in tarefaArquivo) {
            if(!dadosNaoEnviados.includes(key)){
                returnObj[key] = tarefaArquivo[key];
            }
        }

        returnObj.src = buildImgSrc(tarefaArquivo.public_url);

        return res.status(200).json(defaultResponse('Arquivo registrado', { ...returnObj }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse('Erro interno ao salvar arquivos'));
    }
};

export default authMiddleware(handler);
