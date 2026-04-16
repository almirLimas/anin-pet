import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources';
import { PrismaService } from '../prisma/prisma.service';
import { ClientesService } from '../clientes/clientes.service';
import { PetsService } from '../pets/pets.service';
import { ServicosService } from '../servicos/servicos.service';
import { EstoqueService } from '../estoque/estoque.service';

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_cep',
      description:
        'Busca o endereço completo a partir de um CEP brasileiro via ViaCEP. Use sempre que o usuário informar um CEP durante o cadastro de cliente.',
      parameters: {
        type: 'object',
        properties: {
          cep: {
            type: 'string',
            description: 'CEP com 8 dígitos (somente números)',
          },
        },
        required: ['cep'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_clientes',
      description: 'Busca clientes pelo nome, telefone ou CPF',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description: 'Nome, telefone ou CPF do cliente',
          },
        },
        required: ['busca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cadastrar_cliente',
      description:
        'Cadastra um novo cliente no sistema. Só chamar quando TODOS os campos obrigatórios e de endereço forem coletados.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome completo do cliente' },
          telefonePrincipal: {
            type: 'string',
            description: 'WhatsApp/Telefone principal (somente dígitos)',
          },
          email: {
            type: 'string',
            description: 'E-mail do cliente (opcional)',
          },
          cpf: { type: 'string', description: 'CPF do cliente (opcional)' },
          cep: { type: 'string', description: 'CEP do endereço' },
          rua: { type: 'string', description: 'Nome da rua/avenida' },
          numero: { type: 'string', description: 'Número do endereço' },
          complemento: {
            type: 'string',
            description: 'Complemento (apto, bloco etc.) — opcional',
          },
          bairro: { type: 'string', description: 'Bairro' },
          cidade: { type: 'string', description: 'Cidade' },
          estado: { type: 'string', description: 'Estado (sigla, ex: SP)' },
          dataNascimento: {
            type: 'string',
            description:
              'Data de nascimento do cliente no formato YYYY-MM-DD (opcional)',
          },
          comoConheceu: {
            type: 'string',
            description: 'Como o cliente conheceu o pet shop (opcional)',
          },
          observacoes: {
            type: 'string',
            description: 'Observações gerais (opcional)',
          },
          mensalista: {
            type: 'boolean',
            description:
              'Se o cliente é mensalista (plano mensal). Padrão: false',
          },
          valorMensal: {
            type: 'number',
            description:
              'Valor do plano mensal em reais (obrigatório se mensalista for true)',
          },
          diaVencimento: {
            type: 'number',
            description:
              'Dia do mês para vencimento do plano mensal, de 1 a 28 (obrigatório se mensalista for true)',
          },
          pets: {
            type: 'array',
            description: 'Lista de pets do cliente (pelo menos um obrigatório)',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string', description: 'Nome do pet' },
                especie: {
                  type: 'string',
                  description:
                    'Esp\u00e9cie (ex: C\u00e3o, Gato, Coelho, Ave, R\u00e9ptil, Outro)',
                },
                raca: { type: 'string', description: 'Ra\u00e7a do pet' },
                sexo: {
                  type: 'string',
                  enum: ['Macho', 'F\u00eamea'],
                  description: 'Sexo do pet',
                },
                peso: { type: 'string', description: 'Peso em kg (ex: 10.5)' },
                dataNascimento: {
                  type: 'string',
                  description: 'Data de nascimento YYYY-MM-DD (opcional)',
                },
                porte: {
                  type: 'string',
                  description:
                    'Porte (Pequeno, M\u00e9dio, Grande, Gigante) \u2014 opcional',
                },
                observacoes: {
                  type: 'string',
                  description: 'Observa\u00e7\u00f5es do pet (opcional)',
                },
              },
              required: ['nome', 'especie', 'raca'],
            },
          },
        },
        required: [
          'nome',
          'telefonePrincipal',
          'cep',
          'rua',
          'numero',
          'bairro',
          'cidade',
          'estado',
          'pets',
        ],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cadastrar_pet',
      description:
        'Cadastra um pet para um cliente existente. Só chamar quando nome, espécie, raça, peso e data de nascimento forem coletados.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: {
            type: 'string',
            description: 'ID do cliente dono do pet',
          },
          nome: { type: 'string', description: 'Nome do pet' },
          especie: {
            type: 'string',
            description:
              'Espécie do pet (ex: Cão, Gato, Coelho, Ave, Réptil, Outro)',
          },
          raca: { type: 'string', description: 'Raça do pet' },
          sexo: {
            type: 'string',
            enum: ['Macho', 'Fêmea'],
            description: 'Sexo do pet',
          },
          tamanho: {
            type: 'string',
            enum: ['Pequeno', 'Médio', 'Grande', 'Gigante'],
            description: 'Porte do pet',
          },
          peso: { type: 'string', description: 'Peso do pet em kg (ex: 10.5)' },
          dataNascimento: {
            type: 'string',
            description: 'Data de nascimento do pet no formato YYYY-MM-DD',
          },
          observacoes: {
            type: 'string',
            description: 'Observações sobre o pet (opcional)',
          },
        },
        required: [
          'clienteId',
          'nome',
          'especie',
          'raca',
          'sexo',
          'peso',
          'dataNascimento',
        ],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_servicos',
      description: 'Lista os serviços disponíveis no pet shop',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_dashboard',
      description:
        'Retorna um resumo completo do negócio: total de clientes, mensalistas, agendamentos de hoje, receita e despesa do mês, avaliação média e produtos com estoque baixo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_mensalistas',
      description:
        'Lista todos os clientes mensalistas com nome, telefone, valor mensal, dia de vencimento e status de pagamento.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_agendamentos',
      description:
        'Busca agendamentos por data, período ou status. Use para responder perguntas como "quem tem agendamento hoje", "agendamentos da semana", "agendamentos pendentes".',
      parameters: {
        type: 'object',
        properties: {
          dataInicio: {
            type: 'string',
            description: 'Data início no formato YYYY-MM-DD (opcional)',
          },
          dataFim: {
            type: 'string',
            description: 'Data fim no formato YYYY-MM-DD (opcional)',
          },
          status: {
            type: 'string',
            description:
              'Status do agendamento: Agendado, Confirmado, EmAtendimento, Concluido, Cancelado, NaoCompareceu (opcional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_financeiro',
      description:
        'Retorna resumo financeiro com receitas e despesas por período. Use para responder sobre faturamento, lucro, despesas.',
      parameters: {
        type: 'object',
        properties: {
          mes: {
            type: 'number',
            description: 'Mês (1-12). Se não informado, usa o mês atual.',
          },
          ano: {
            type: 'number',
            description: 'Ano (ex: 2026). Se não informado, usa o ano atual.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_estoque',
      description:
        'Lista ou busca produtos do estoque. Use para verificar se um produto existe, sua quantidade e preço. Pode filtrar por nome e/ou por estoque baixo.',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description:
              'Nome ou parte do nome do produto a buscar (ex: shampoo, ração, antipulgas)',
          },
          apenasEstoqueBaixo: {
            type: 'boolean',
            description:
              'Se true, retorna apenas produtos com estoque abaixo do mínimo',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_pets',
      description:
        'Busca pets por nome do pet ou nome do dono. Use para responder sobre pets cadastrados.',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description: 'Nome do pet ou nome do dono',
          },
        },
        required: ['busca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_avaliacoes',
      description:
        'Retorna resumo das avaliações dos clientes: média, total de respostas, distribuição por nota.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cadastrar_servico',
      description:
        'Cadastra um novo serviço no pet shop. Só chamar quando nome, categoria e preço forem informados.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do serviço' },
          categoria: {
            type: 'string',
            enum: [
              'Banho',
              'Tosa',
              'Consulta',
              'Vacina',
              'Internacao',
              'Cirurgia',
              'Exame',
              'Outro',
            ],
            description: 'Categoria do serviço',
          },
          preco: {
            type: 'number',
            description: 'Preço em reais (deve ser > 0)',
          },
          duracaoMinutos: {
            type: 'number',
            description: 'Duração em minutos (deve ser > 0, opcional)',
          },
          porte: {
            type: 'string',
            enum: ['Pequeno', 'Medio', 'Grande', 'Todos'],
            description: 'Porte atendido (padrão: Todos)',
          },
          descricao: {
            type: 'string',
            description: 'Descrição do serviço (opcional)',
          },
        },
        required: ['nome', 'categoria', 'preco', 'duracaoMinutos'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cadastrar_produto',
      description:
        'Cadastra um novo produto no estoque. Só chamar quando nome, categoria, preço de compra e preço de venda forem informados.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do produto' },
          categoria: {
            type: 'string',
            enum: [
              'Medicamento',
              'Alimento',
              'Acessorio',
              'Higiene',
              'Vacina',
              'Outro',
            ],
            description: 'Categoria do produto',
          },
          precoCompra: {
            type: 'number',
            description: 'Preço de compra em reais (deve ser > 0)',
          },
          precoVenda: {
            type: 'number',
            description: 'Preço de venda em reais (deve ser > 0)',
          },
          quantidadeAtual: {
            type: 'number',
            description: 'Quantidade inicial em estoque (padrão: 0)',
          },
          estoqueMinimo: {
            type: 'number',
            description: 'Quantidade mínima para alerta (padrão: 0)',
          },
          unidade: {
            type: 'string',
            description: 'Unidade de medida (ex: un, kg, ml — opcional)',
          },
          marca: { type: 'string', description: 'Marca do produto (opcional)' },
          descricao: {
            type: 'string',
            description: 'Descrição do produto (opcional)',
          },
        },
        required: ['nome', 'categoria', 'precoCompra', 'precoVenda'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_agendamento',
      description:
        'Atualiza o status de um agendamento existente. Use para concluir, cancelar, confirmar ou marcar como não compareceu.',
      parameters: {
        type: 'object',
        properties: {
          agendamentoId: {
            type: 'string',
            description:
              'ID do agendamento (obtido via buscar_agendamentos, campo id)',
          },
          status: {
            type: 'string',
            enum: [
              'Agendado',
              'Confirmado',
              'EmAtendimento',
              'Concluido',
              'Cancelado',
              'NaoCompareceu',
            ],
            description: 'Novo status do agendamento',
          },
        },
        required: ['agendamentoId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_agendamento',
      description:
        'Cria um agendamento de serviço para um pet. Use servicoNomes (nomes dos serviços) para indicar os serviços — o sistema resolve os IDs automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          clienteId: {
            type: 'string',
            description: 'ID do cliente (obtido via buscar_clientes)',
          },
          petId: {
            type: 'string',
            description: 'ID do pet (obtido via buscar_pets, campo id)',
          },
          servicoNomes: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Nomes dos servi\u00e7os a agendar (ex: ["Tosa", "Banho"]). O sistema resolve os IDs automaticamente.',
          },
          dataHora: {
            type: 'string',
            description:
              'Data e hora no formato ISO 8601 (ex: 2026-04-15T14:00:00)',
          },
          modalidade: {
            type: 'string',
            enum: ['ClienteTraz', 'PetshopBusca'],
            description:
              'ClienteTraz = cliente traz o pet ao pet shop. PetshopBusca = pet shop busca o pet na casa do cliente. Padrão: ClienteTraz.',
          },
          enderecoBusca: {
            type: 'string',
            description:
              'Endereço de busca do pet (usado quando modalidade = PetshopBusca). Se não informado, será preenchido automaticamente com o endereço cadastrado do cliente.',
          },
          observacoes: {
            type: 'string',
            description: 'Observações opcionais',
          },
        },
        required: ['clienteId', 'petId', 'servicoNomes', 'dataHora'],
      },
    },
  },
];

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesService,
    private readonly pets: PetsService,
    private readonly servicos: ServicosService,
    private readonly estoque: EstoqueService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.get<string>('OPENAI_API_KEY'),
    });
  }

  async chat(
    tenantId: string,
    mensagens: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ resposta: string; acoesRealizadas: string[] }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY não configurada');
      return {
        resposta:
          'Assistente de IA não configurado. Entre em contato com o suporte.',
        acoesRealizadas: [],
      };
    }

    const agora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    const systemPrompt = `Você se chama Anin. Sempre que se apresentar ou for perguntado seu nome, diga apenas "Anin". Nunca use "Assistente AninPet" ou qualquer outro nome.
Você é a assistente inteligente do sistema AninPet, um sistema completo para pet shop.

USO DE EMOJIS NAS RESPOSTAS:
Use emojis de forma contextual e natural para deixar as respostas mais visuais e amigáveis. Exemplos:
- Cadastro concluído com sucesso → 🎉 ou ✅
- Agendamento criado → 📅 ✅
- Cliente encontrado → 👤
- Pet cadastrado → 🐾 ✅
- Serviço cadastrado → ✂️ ✅ (ou ícone da categoria: 🛁 banho, ✂️ tosa, 💉 vacina)
- Produto cadastrado → 📦 ✅
- Consulta financeira → 💰
- Estoque → 🏪
- Agendamentos do dia → 📅
- Dashboard/resumo → 📊
- Avaliações → ⭐
- Erro ou dado inválido → ⚠️
- Pergunta/coleta de dados → sem emoji ou emoji neutro
- Mensalistas → 📋
Não exagere — use 1 a 2 emojis por resposta, no início ou em itens de lista. Nunca use emojis em meio a uma frase de forma forçada.

FORMATAÇÃO DE TEXTO:
- NUNCA use markdown com asteriscos (**negrito**, *itálico*) — o chat não renderiza markdown.
- Para resumos e confirmações, use emojis como prefixo de cada linha no lugar do negrito. Exemplo de resumo de agendamento:
  👤 Cliente: João Silva
  🐾 Pet: Rex
  ✂️ Serviço: Tosa
  📅 Data: 20/04/2026 às 14:00
  🚗 Modalidade: Pet shop busca
- Para listas de itens, use emojis ou traços simples (—) como marcadores.
- Para confirmações de sucesso, use ✅ ou 🎉 no início da linha principal.

CONTEXTO IMPORTANTÍSSIMO:
- Quem está conversando com você é o DONO ou FUNCIONÁRIO do pet shop, não um cliente.
- Quando alguém diz "tenho agendamento hoje?", "quais são meus agendamentos?", "quantos clientes tenho?", está perguntando sobre os dados DO pet shop deles.
- NUNCA peça nome, telefone ou CPF de quem está conversando — ele já é o usuário autenticado no sistema.
- Responda como se fosse um gerente ajudando o dono a consultar o próprio negócio.

CAPACIDADES:
- Responder perguntas sobre clientes, mensalistas, pets, agendamentos, financeiro, estoque e avaliações
- Cadastrar novos clientes e pets coletando todos os dados obrigatórios
- Criar agendamentos de serviços
- Fornecer relatórios e resumos do negócio

REGRAS PARA CONSULTAS:
1. Quando o usuário perguntar sobre dados do sistema (clientes, agendamentos, financeiro, etc.), chame a ferramenta adequada IMEDIATAMENTE sem pedir confirmação nem dados do usuário.
2. Use consultar_dashboard para perguntas gerais sobre o negócio.
3. Use consultar_mensalistas para qualquer pergunta sobre clientes mensalistas.
4. Use buscar_agendamentos para perguntas sobre agenda do dia, semana ou período específico ("agendamentos de hoje", "agenda de amanhã", "quem vem hoje"). Para "hoje", use a data atual sem perguntar nada.
5. Use listar_servicos para perguntas sobre o CATÁLOGO de serviços do pet shop ("quais serviços você tem?", "quais serviços ofereço?", "me liste os serviços", "quais serviços tenho?"). NÃO confunda com agendamentos.
6. Use consultar_financeiro para perguntas sobre receita, despesa, faturamento e lucro.
7. Use consultar_estoque para perguntas sobre produtos e estoque, passando o nome do produto quando mencionado.
8. Use buscar_pets para buscar pets por nome.
9. Use consultar_avaliacoes para perguntas sobre satisfação e avaliações.

REGRAS PARA CADASTROS:
1. NUNCA chame cadastrar_cliente sem ter coletado: nome, WhatsApp, CEP, rua, número, bairro, cidade, estado E os dados de pelo menos um pet.
2. NUNCA chame cadastrar_pet sem ter coletado: nome do pet, espécie, raça, sexo, peso e data de nascimento.
3. NUNCA chame cadastrar_servico sem ter coletado: nome, categoria, preço e duração em minutos.
4. NUNCA chame cadastrar_produto sem ter coletado: nome, categoria, preço de compra e preço de venda.
5. NUNCA chame criar_agendamento sem ter clienteId, petId, servicoNomes e dataHora confirmados. NUNCA peça IDs diretamente ao usuário — busque por nome e resolva os IDs internamente.
6. Colete as informações faltantes UMA PERGUNTA POR VEZ, de forma natural e amigável.
7. Só chame a função de cadastro quando TODOS os campos obrigatórios estiverem coletados e validados.

ATENÇÃO — CONCLUIR ≠ CRIAR:
- "Concluir agendamento", "marcar como concluído", "fechar atendimento", "cancelar agendamento", "confirmar agendamento" são operações de ATUALIZAÇÃO DE STATUS — use atualizar_agendamento.
- "Criar agendamento", "agendar", "marcar horário" são operações de CRIAÇÃO — use criar_agendamento.
- NUNCA chame criar_agendamento quando o usuário quiser alterar o status de um agendamento existente.

VALIDAÇÕES OBRIGATÓRIAS (aplique ANTES de chamar qualquer função de cadastro):

CLIENTE:
- nome: valide APENAS o formato — aceite qualquer combinação de letras (incluindo nomes incomuns, estrangeiros ou que pareçam marcas), acentos, espaços, apóstrofo e hífen. PROIBIDO números ou símbolos. Mínimo 3 caracteres. NÃO julgue se o nome parece real ou não — apenas verifique os caracteres.
- telefonePrincipal: ANTES de validar, remova espaços, traços, parênteses e outros caracteres de formatação e extraia apenas os dígitos. O número de dígitos resultante deve ser 10 ou 11 (com DDD). Se inválido após a limpeza, peça novamente.
- email: formato válido (usuario@dominio.com). Se inválido, peça novamente ou confirme que não tem e-mail.
- cpf: se informado, deve ter 11 dígitos numéricos e ser um CPF válido (dígitos verificadores corretos).
- cep: deve ter 8 dígitos numéricos.
- rua, bairro, cidade: obrigatórios, não podem estar em branco.
- estado: obrigatório, sigla com 2 letras (ex: SP, RJ, MG).
- numero: obrigatório, não pode estar em branco.
- dataNascimento: se informada, o cliente deve ter pelo menos 18 anos.

SERVIÇO:
- nome: obrigatório, não vazio.
- categoria: deve ser exatamente um de: Banho, Tosa, Consulta, Vacina, Internacao, Cirurgia, Exame, Outro. Apresente as opções ao usuário.
- preco: número maior que zero.
- duracaoMinutos: obrigatório, deve ser maior que zero.
- porte: deve ser um de: Pequeno, Medio, Grande, Todos. Padrão: Todos.

PET (dentro do cadastro de cliente):
- nome: obrigatório, não vazio.
- especie: obrigatória (Cão, Gato, Coelho, Ave, Réptil, Outro).
- raca: obrigatória, não pode estar em branco.
- sexo, peso: colete se possível, mas não bloqueie o cadastro se o usuário não souber.

PRODUTO:
- nome: obrigatório, não vazio.
- categoria: deve ser exatamente um de: Medicamento, Alimento, Acessorio, Higiene, Vacina, Outro. Apresente as opções ao usuário.
- precoCompra: número maior que zero.
- precoVenda: número maior que zero.
- quantidadeAtual: número >= 0. Padrão: 0.
- estoqueMinimo: número >= 0. Padrão: 0.

AGENDAMENTO:
- NUNCA peça IDs ao usuário. Sempre busque por nome e resolva os IDs internamente.
- clienteId: obtido via buscar_clientes → use o campo "id" do resultado.
- petId: obtido via buscar_pets → use o campo "id" do resultado.
- servicoNomes: passe os NOMES dos serviços escolhidos (ex: ["Tosa", "Banho"]). O sistema resolve os IDs automaticamente — NUNCA passe IDs de serviço.
- dataHora: deve estar no futuro, formato ISO 8601 (ex: 2026-04-20T14:00:00).
- Se houver múltiplos resultados em qualquer busca, liste as opções com nome e telefone/detalhe e peça confirmação.

FLUXO PARA CADASTRO DE CLIENTE:
1. Nome completo (valide: só letras/acentos/espaços/hífen/apóstrofo, mín. 3 chars — aceite qualquer nome, não julgue se parece marca ou nome incomum)
2. WhatsApp (remova espaços e formatação, valide: 10 ou 11 dígitos com DDD)
3. E-mail (opcional) e CPF (opcional) — pode perguntar juntos
4. Pergunte: "O cliente é mensalista (plano mensal)?"
   - Se sim: pergunte o valor mensal (R$) e o dia de vencimento (1 a 28)
   - Se não: mensalista = false, não pergunte valor nem dia
5. CEP → chame buscar_cep IMEDIATAMENTE ao receber o CEP
   - Se encontrar o endereço: apresente rua, bairro e cidade e pergunte "Os dados estão corretos?"
   - Se o usuário confirmar: pergunte APENAS o número (e complemento opcional)
   - Se o usuário disser que está errado: pergunte rua, bairro, cidade e estado manualmente
   - Se o CEP não for encontrado (ViaCEP retornar erro): informe que não foi possível encontrar o CEP na base de dados e peça IMEDIATAMENTE os dados manualmente (rua, bairro, cidade, estado). NÃO peça um novo CEP — siga com o CEP informado e colete o endereço manualmente.
6. OBRIGATÓRIO — Dados do pet: pergunte nome do pet, espécie, raça, sexo e peso
   - Diga: "Agora preciso dos dados do pet. Qual o nome dele?"
   - Colete: nome → espécie → raça (obrigatória) → sexo → peso (data de nascimento é opcional)
   - Se o usuário não souber sexo ou peso, registre como não informado. Raça é obrigatória — insista se não informada.
7. Com todos os dados (cliente + pelo menos 1 pet) → chame cadastrar_cliente passando os dados do cliente E o array pets com os dados coletados
8. NUNCA pergunte "Deseja adicionar mais alguma informação?" antes de coletar os dados do pet — o pet é OBRIGATÓRIO

FLUXO PARA CADASTRO DE PET (após ter o clienteId):
- Nome do pet → espécie → raça → sexo → data de nascimento → peso → cadastra

FLUXO PARA CADASTRO DE SERVIÇO:
1. Nome do serviço
2. Categoria (apresente as opções: Banho, Tosa, Consulta, Vacina, Internacao, Cirurgia, Exame, Outro)
3. Preço (valide: > 0)
4. Duração em minutos (obrigatório, valide: > 0)
5. Porte (opcional, opções: Pequeno, Medio, Grande, Todos — padrão Todos)
6. Confirme os dados e chame cadastrar_servico

FLUXO PARA CADASTRO DE PRODUTO:
1. Nome do produto
2. Categoria (apresente as opções: Medicamento, Alimento, Acessorio, Higiene, Vacina, Outro)
3. Preço de compra (valide: > 0)
4. Preço de venda (valide: > 0)
5. Unidade de medida — infira automaticamente pelo nome/categoria antes de perguntar:
   - Produtos líquidos (shampoo, condicionador, colônia, perfume, solução, loção, soro) → ml
   - Alimentos (ração, petisco, snack, biscoito) → kg ou g dependendo do contexto
   - Medicamentos em comprimido/cápsula → un
   - Acessórios, brinquedos, coleiras, roupas → un
   - Se não conseguir inferir com segurança, pergunte: "Qual a unidade? (un, kg, g, ml, L)"
6. Quantidade atual em estoque — pergunte de forma natural: "Quantas unidades [ou ml/kg] você tem em estoque agora?" (padrão: 0 se não souber)
7. Estoque mínimo — pergunte: "Qual a quantidade mínima para receber alerta de estoque baixo?" (padrão: 0)
8. Confirme os dados e chame cadastrar_produto

FLUXO PARA ATUALIZAR STATUS DE AGENDAMENTO:
1. Pergunte qual agendamento o usuário quer atualizar (por cliente, pet ou data)
2. Chame buscar_agendamentos para localizar o agendamento — use o campo "id" do resultado
3. Se houver mais de um resultado, liste-os e pergunte qual
4. Confirme o novo status e chame atualizar_agendamento com o id e o novo status
   - Concluído → status: "Concluido"
   - Cancelado → status: "Cancelado"
   - Confirmado → status: "Confirmado"
   - Em atendimento → status: "EmAtendimento"
   - Não compareceu → status: "NaoCompareceu"

FLUXO PARA CRIAÇÃO DE AGENDAMENTO:
1. Pergunte o NOME do cliente (nunca o ID)
2. Chame buscar_clientes com o nome informado
   - Se retornar 1 resultado: use o campo "id" como clienteId
   - Se retornar múltiplos: liste-os (nome + telefone) e pergunte "Qual desses é o cliente?"
   - Se não encontrar: avise e peça o nome novamente
3. Pergunte o nome do pet
4. Chame buscar_pets com o nome do pet
   - Use o campo "id" do resultado como petId
   - Filtre pelo clienteId já identificado (campo "clienteId" no resultado)
   - Se múltiplos pets do mesmo dono: liste e pergunte qual
5. OBRIGATÓRIO: chame listar_servicos para obter os serviços REAIS cadastrados no sistema — NUNCA invente nem liste categorias. Apresente ao usuário o nome e preço de cada serviço retornado pela ferramenta. O usuário escolhe pelo NOME.
6. Pergunte a data e hora do agendamento (valide: deve ser no futuro)
7. Pergunte a modalidade: "O cliente vai trazer o pet ou o pet shop vai buscar?"
   - Cliente traz → modalidade: "ClienteTraz"
   - Pet shop busca → modalidade: "PetshopBusca"
8. Confirme os dados resumidos (cliente, pet, serviços, data/hora, modalidade) e chame criar_agendamento passando clienteId, petId, servicoNomes (array com os NOMES dos serviços escolhidos), dataHora e modalidade

Data e hora atual: ${agora}.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...mensagens,
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 10;
    const acoesRealizadas: string[] = [];

    try {
      while (iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
        });

        const choice = response.choices[0];
        if (!choice) break;

        const message = choice.message;
        messages.push(message as ChatCompletionMessageParam);

        if (
          choice.finish_reason !== 'tool_calls' ||
          !message.tool_calls?.length
        ) {
          return { resposta: message.content ?? '', acoesRealizadas };
        }

        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== 'function') continue;
          const args = JSON.parse(toolCall.function.arguments) as Record<
            string,
            unknown
          >;
          const result = await this.executarFerramenta(
            tenantId,
            toolCall.function.name,
            args,
          );
          const resultObj = result as Record<string, unknown>;
          if (!resultObj?.erro) {
            const acoesMutacao = [
              'cadastrar_cliente',
              'cadastrar_pet',
              'cadastrar_servico',
              'cadastrar_produto',
              'criar_agendamento',
              'atualizar_agendamento',
            ];
            if (acoesMutacao.includes(toolCall.function.name)) {
              acoesRealizadas.push(toolCall.function.name);
            }
          }
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro na chamada OpenAI: ${msg}`);
      return { resposta: `Erro ao processar: ${msg}`, acoesRealizadas };
    }

    return {
      resposta: 'Não consegui completar a solicitação. Tente novamente.',
      acoesRealizadas,
    };
  }

  private async executarFerramenta(
    tenantId: string,
    nome: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    this.logger.log(`Executando ferramenta: ${nome}`, args);

    const str = (v: unknown): string => (v as string) ?? '';
    const optStr = (v: unknown): string | undefined =>
      v ? (v as string) : undefined;
    const formatTelefone = (v: unknown): string => {
      const d = str(v).replaceAll(/\D/g, '').slice(0, 11);
      if (d.length === 11)
        return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      if (d.length === 10)
        return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return d;
    };

    try {
      switch (nome) {
        case 'buscar_cep': {
          const cepLimpo = str(args.cep).replaceAll(/\D/g, '');
          if (cepLimpo.length !== 8) {
            return { erro: 'CEP inválido. O CEP deve ter 8 dígitos.' };
          }
          const resp = await fetch(
            `https://viacep.com.br/ws/${cepLimpo}/json/`,
          );
          if (!resp.ok) {
            return {
              erro: 'Não foi possível consultar o CEP. Tente novamente.',
            };
          }
          const dados = (await resp.json()) as Record<string, unknown>;
          if (dados.erro) {
            return { erro: 'CEP não encontrado. Verifique o CEP informado.' };
          }
          return {
            cep: dados.cep,
            rua: dados.logradouro,
            bairro: dados.bairro,
            cidade: dados.localidade,
            estado: dados.uf,
          };
        }

        case 'cadastrar_servico': {
          const preco = Number(args.preco);
          if (!args.nome || str(args.nome).trim() === '') {
            return { erro: 'Nome do serviço é obrigatório.' };
          }
          if (Number.isNaN(preco) || preco <= 0) {
            return { erro: 'Preço deve ser maior que zero.' };
          }
          const duracaoMinutos = args.duracaoMinutos
            ? Number(args.duracaoMinutos)
            : undefined;
          if (
            duracaoMinutos !== undefined &&
            (Number.isNaN(duracaoMinutos) || duracaoMinutos <= 0)
          ) {
            return { erro: 'Duração deve ser maior que zero.' };
          }
          return await this.servicos.create(tenantId, {
            nome: str(args.nome),
            categoria: str(
              args.categoria,
            ) as import('@prisma/client').CategoriaServico,
            preco,
            duracaoMinutos,
            porte: optStr(args.porte) as
              | import('@prisma/client').PorteServico
              | undefined,
            descricao: optStr(args.descricao),
          });
        }

        case 'cadastrar_produto': {
          const precoCompra = Number(args.precoCompra);
          const precoVenda = Number(args.precoVenda);
          if (!args.nome || str(args.nome).trim() === '') {
            return { erro: 'Nome do produto é obrigatório.' };
          }
          if (Number.isNaN(precoCompra) || precoCompra <= 0) {
            return { erro: 'Preço de compra deve ser maior que zero.' };
          }
          if (Number.isNaN(precoVenda) || precoVenda <= 0) {
            return { erro: 'Preço de venda deve ser maior que zero.' };
          }
          const quantidadeAtual = args.quantidadeAtual
            ? Number(args.quantidadeAtual)
            : 0;
          const estoqueMinimo = args.estoqueMinimo
            ? Number(args.estoqueMinimo)
            : 0;
          if (quantidadeAtual < 0) {
            return { erro: 'Quantidade atual não pode ser negativa.' };
          }
          if (estoqueMinimo < 0) {
            return { erro: 'Estoque mínimo não pode ser negativo.' };
          }
          return await this.estoque.createProduto(tenantId, {
            nome: str(args.nome),
            categoria: str(
              args.categoria,
            ) as import('@prisma/client').CategoriaEstoque,
            precoCompra,
            precoVenda,
            quantidadeAtual,
            estoqueMinimo,
            unidade: optStr(args.unidade),
            marca: optStr(args.marca),
            descricao: optStr(args.descricao),
          });
        }

        case 'buscar_clientes': {
          const resultado = await this.clientes.findAll(
            tenantId,
            1,
            5,
            str(args.busca),
          );
          return resultado.data.map((c) => ({
            id: c.id,
            nome: c.nome,
            telefone: c.telefonePrincipal,
            email: c.email ?? null,
            cpf: c.cpf ?? null,
            endereco:
              [c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.estado]
                .filter(Boolean)
                .join(', ') || null,
            cep: c.cep ?? null,
            mensalista: c.mensalista,
            observacoes: c.observacoes ?? null,
          }));
        }

        case 'cadastrar_cliente':
          return await this.clientes.create(tenantId, {
            nome: str(args.nome),
            telefonePrincipal: formatTelefone(args.telefonePrincipal),
            email: optStr(args.email),
            cpf: optStr(args.cpf),
            cep: optStr(args.cep),
            rua: optStr(args.rua),
            numero: optStr(args.numero),
            complemento: optStr(args.complemento),
            bairro: optStr(args.bairro),
            cidade: optStr(args.cidade),
            estado: optStr(args.estado),
            dataNascimento: optStr(args.dataNascimento),
            comoConheceu: optStr(args.comoConheceu),
            observacoes: optStr(args.observacoes),
            mensalista: args.mensalista === true,
            valorMensal: args.valorMensal
              ? Number(args.valorMensal)
              : undefined,
            diaVencimento: args.diaVencimento
              ? Number(args.diaVencimento)
              : undefined,
            pets: Array.isArray(args.pets)
              ? (args.pets as Record<string, unknown>[]).map((p) => ({
                  nome: str(p.nome),
                  especie: str(p.especie),
                  raca: optStr(p.raca),
                  sexo: optStr(p.sexo) as 'Macho' | 'F\u00eamea' | undefined,
                  peso: optStr(p.peso),
                  porte: optStr(p.porte),
                  dataNascimento: optStr(p.dataNascimento),
                  observacoes: optStr(p.observacoes),
                }))
              : undefined,
          } as Parameters<ClientesService['create']>[1]);

        case 'cadastrar_pet':
          return await this.pets.create(tenantId, {
            clienteId: str(args.clienteId),
            nome: str(args.nome),
            especie: str(args.especie),
            raca: optStr(args.raca),
            sexo: args.sexo as 'Macho' | 'F\u00eamea' | undefined,
            porte: optStr(args.tamanho),
            peso: optStr(args.peso),
            dataNascimento: optStr(args.dataNascimento),
            observacoes: optStr(args.observacoes),
          });

        case 'listar_servicos': {
          const servicos = await this.servicos.findAll(tenantId, true);
          if (servicos.length === 0) {
            return {
              aviso: 'Nenhum serviço cadastrado no sistema.',
              servicos: [],
            };
          }
          return {
            total: servicos.length,
            servicos: servicos.map((s) => ({
              nome: s.nome,
              categoria: s.categoria,
              preco: `R$ ${Number(s.preco).toFixed(2)}`,
              duracaoMinutos: s.duracaoMinutos,
              porte: s.porte,
            })),
          };
        }

        case 'consultar_dashboard': {
          const agora = new Date();
          const inicioDia = new Date(agora);
          inicioDia.setHours(0, 0, 0, 0);
          const fimDia = new Date(agora);
          fimDia.setHours(23, 59, 59, 999);
          const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
          const fimMes = new Date(
            agora.getFullYear(),
            agora.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          );

          const [
            totalClientes,
            totalMensalistas,
            agendamentosHoje,
            totalAgendamentosMes,
            receitaMes,
            despesaMes,
            avaliacoes,
            totalEstoqueBaixo,
          ] = await Promise.all([
            this.prisma.cliente.count({ where: { tenantId, status: 'Ativo' } }),
            this.prisma.cliente.count({
              where: { tenantId, mensalista: true, status: 'Ativo' },
            }),
            this.prisma.agendamento.findMany({
              where: { tenantId, dataHora: { gte: inicioDia, lte: fimDia } },
              include: {
                cliente: { select: { nome: true } },
                pet: { select: { nome: true } },
                servicos: { include: { servico: { select: { nome: true } } } },
              },
              orderBy: { dataHora: 'asc' },
            }),
            this.prisma.agendamento.count({
              where: { tenantId, dataHora: { gte: inicioMes, lte: fimMes } },
            }),
            this.prisma.lancamento.aggregate({
              where: {
                tenantId,
                tipo: 'Receita',
                data: { gte: inicioMes, lte: fimMes },
              },
              _sum: { valor: true },
            }),
            this.prisma.lancamento.aggregate({
              where: {
                tenantId,
                tipo: 'Despesa',
                data: { gte: inicioMes, lte: fimMes },
              },
              _sum: { valor: true },
            }),
            this.prisma.avaliacaoCliente.aggregate({
              where: { tenantId, respondidaEm: { not: null } },
              _avg: { nota: true },
              _count: { nota: true },
            }),
            this.prisma.produto
              .findMany({
                where: { tenantId, ativo: true },
                select: { quantidadeAtual: true, estoqueMinimo: true },
              })
              .then(
                (ps) =>
                  ps.filter((p) => p.quantidadeAtual <= p.estoqueMinimo).length,
              )
              .catch(() => 0),
          ]);

          const receita = Number(receitaMes._sum.valor ?? 0);
          const despesa = Number(despesaMes._sum.valor ?? 0);

          return {
            totalClientesAtivos: totalClientes,
            totalMensalistas,
            agendamentosHoje: agendamentosHoje.map((a) => ({
              horario: a.dataHora.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              cliente: a.cliente.nome,
              pet: a.pet.nome,
              servicos: a.servicos.map((s) => s.servico.nome).join(', '),
              status: a.status,
            })),
            totalAgendamentosHoje: agendamentosHoje.length,
            totalAgendamentosMes,
            produtosEstoqueBaixo: totalEstoqueBaixo,
            receitaMes: receita,
            despesaMes: despesa,
            lucroMes: receita - despesa,
            avaliacaoMedia: avaliacoes._avg.nota
              ? Number(avaliacoes._avg.nota).toFixed(1)
              : 'sem avaliações',
            totalAvaliacoes: avaliacoes._count.nota,
          };
        }

        case 'consultar_mensalistas': {
          const mensalistas = await this.prisma.cliente.findMany({
            where: { tenantId, mensalista: true },
            select: {
              nome: true,
              telefonePrincipal: true,
              valorMensal: true,
              diaVencimento: true,
              ultimaMensalidadePaga: true,
              status: true,
            },
            orderBy: { nome: 'asc' },
          });
          return {
            total: mensalistas.length,
            clientes: mensalistas.map((c) => ({
              nome: c.nome,
              telefone: c.telefonePrincipal,
              valorMensal: c.valorMensal
                ? `R$ ${Number(c.valorMensal).toFixed(2)}`
                : 'não definido',
              diaVencimento: c.diaVencimento ?? 'não definido',
              ultimoPagamento: c.ultimaMensalidadePaga
                ? c.ultimaMensalidadePaga.toLocaleDateString('pt-BR')
                : 'nunca pago',
              status: c.status,
            })),
          };
        }

        case 'buscar_agendamentos': {
          const agora = new Date();
          const dataInicio = args.dataInicio
            ? new Date(str(args.dataInicio) + 'T00:00:00')
            : new Date(
                agora.getFullYear(),
                agora.getMonth(),
                agora.getDate(),
                0,
                0,
                0,
              );
          const dataFim = args.dataFim
            ? new Date(str(args.dataFim) + 'T23:59:59')
            : new Date(
                agora.getFullYear(),
                agora.getMonth(),
                agora.getDate(),
                23,
                59,
                59,
              );

          const agendamentos = await this.prisma.agendamento.findMany({
            where: {
              tenantId,
              dataHora: { gte: dataInicio, lte: dataFim },
              ...(args.status
                ? {
                    status: str(
                      args.status,
                    ) as import('@prisma/client').StatusAgendamento,
                  }
                : {}),
            },
            include: {
              cliente: { select: { nome: true, telefonePrincipal: true } },
              pet: { select: { nome: true, especie: true } },
              servicos: {
                include: { servico: { select: { nome: true, preco: true } } },
              },
            },
            orderBy: { dataHora: 'asc' },
            take: 30,
          });

          return {
            total: agendamentos.length,
            agendamentos: agendamentos.map((a) => ({
              id: a.id,
              data: a.dataHora.toLocaleDateString('pt-BR'),
              horario: a.dataHora.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              cliente: a.cliente.nome,
              telefone: a.cliente.telefonePrincipal,
              pet: `${a.pet.nome} (${a.pet.especie ?? ''})`,
              servicos: a.servicos.map((s) => s.servico.nome).join(', '),
              status: a.status,
            })),
          };
        }

        case 'consultar_financeiro': {
          const anoAtual = new Date().getFullYear();
          const mesAtual = new Date().getMonth() + 1;
          const mes = args.mes ? Number(args.mes) : mesAtual;
          const ano = args.ano ? Number(args.ano) : anoAtual;
          const inicio = new Date(ano, mes - 1, 1);
          const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

          const [receitas, despesas, porCategoria] = await Promise.all([
            this.prisma.lancamento.aggregate({
              where: {
                tenantId,
                tipo: 'Receita',
                data: { gte: inicio, lte: fim },
              },
              _sum: { valor: true },
              _count: true,
            }),
            this.prisma.lancamento.aggregate({
              where: {
                tenantId,
                tipo: 'Despesa',
                data: { gte: inicio, lte: fim },
              },
              _sum: { valor: true },
              _count: true,
            }),
            this.prisma.lancamento.groupBy({
              by: ['categoria', 'tipo'],
              where: { tenantId, data: { gte: inicio, lte: fim } },
              _sum: { valor: true },
            }),
          ]);

          const receita = Number(receitas._sum.valor ?? 0);
          const despesa = Number(despesas._sum.valor ?? 0);

          return {
            periodo: `${String(mes).padStart(2, '0')}/${ano}`,
            receita: `R$ ${receita.toFixed(2)}`,
            despesa: `R$ ${despesa.toFixed(2)}`,
            lucro: `R$ ${(receita - despesa).toFixed(2)}`,
            totalLancamentosReceita: receitas._count,
            totalLancamentosDespesa: despesas._count,
            porCategoria: porCategoria.map((c) => ({
              categoria: c.categoria,
              tipo: c.tipo,
              valor: `R$ ${Number(c._sum.valor ?? 0).toFixed(2)}`,
            })),
          };
        }

        case 'consultar_estoque': {
          const apenasEstoqueBaixo = args.apenasEstoqueBaixo === true;
          const busca = optStr(args.busca);
          const produtos = await this.prisma.produto.findMany({
            where: {
              tenantId,
              ativo: true,
              ...(busca
                ? { nome: { contains: busca, mode: 'insensitive' } }
                : {}),
            },
            select: {
              nome: true,
              categoria: true,
              quantidadeAtual: true,
              estoqueMinimo: true,
              precoVenda: true,
              unidade: true,
            },
            orderBy: { nome: 'asc' },
          });

          const resultado = apenasEstoqueBaixo
            ? produtos.filter((p) => p.quantidadeAtual <= p.estoqueMinimo)
            : produtos;

          return {
            total: resultado.length,
            produtos: resultado.map((p) => ({
              nome: p.nome,
              categoria: p.categoria,
              estoque: `${p.quantidadeAtual} ${p.unidade ?? 'un'}`,
              estoqueMinimo: p.estoqueMinimo,
              alerta:
                p.quantidadeAtual <= p.estoqueMinimo
                  ? '⚠️ Estoque baixo'
                  : 'OK',
              precoVenda: p.precoVenda
                ? `R$ ${Number(p.precoVenda).toFixed(2)}`
                : 'não definido',
            })),
          };
        }

        case 'buscar_pets': {
          const pets = await this.prisma.pet.findMany({
            where: {
              tenantId,
              OR: [
                { nome: { contains: str(args.busca), mode: 'insensitive' } },
                {
                  cliente: {
                    nome: { contains: str(args.busca), mode: 'insensitive' },
                  },
                },
              ],
            },
            include: {
              cliente: { select: { nome: true, telefonePrincipal: true } },
            },
            take: 10,
          });

          return pets.map((p) => ({
            id: p.id,
            nome: p.nome,
            especie: p.especie,
            raca: p.raca,
            sexo: p.sexo,
            peso: p.peso,
            dataNascimento: p.dataNascimento,
            dono: p.cliente.nome,
            clienteId: p.clienteId,
            telefoneDono: p.cliente.telefonePrincipal,
          }));
        }

        case 'consultar_avaliacoes': {
          const [media, distribuicao, recentes] = await Promise.all([
            this.prisma.avaliacaoCliente.aggregate({
              where: { tenantId, respondidaEm: { not: null } },
              _avg: { nota: true },
              _count: { nota: true },
            }),
            this.prisma.avaliacaoCliente.groupBy({
              by: ['nota'],
              where: { tenantId, respondidaEm: { not: null } },
              _count: { nota: true },
              orderBy: { nota: 'desc' },
            }),
            this.prisma.avaliacaoCliente.findMany({
              where: { tenantId, respondidaEm: { not: null } },
              include: { cliente: { select: { nome: true } } },
              orderBy: { respondidaEm: 'desc' },
              take: 5,
            }),
          ]);

          return {
            mediaGeral: media._avg.nota
              ? Number(media._avg.nota).toFixed(1)
              : 'sem avaliações',
            totalRespostas: media._count.nota,
            distribuicao: distribuicao.map((d) => ({
              nota: `${d.nota} estrela${d.nota === 1 ? '' : 's'}`,
              quantidade: d._count.nota,
            })),
            recentes: recentes.map((a) => ({
              cliente: a.cliente.nome,
              nota: a.nota,
              data: a.respondidaEm?.toLocaleDateString('pt-BR'),
            })),
          };
        }

        case 'atualizar_agendamento': {
          const agendamento = await this.prisma.agendamento.findFirst({
            where: { id: str(args.agendamentoId), tenantId },
          });
          if (!agendamento) {
            return {
              erro: 'Agendamento não encontrado. Use buscar_agendamentos para localizar o ID correto.',
            };
          }
          return await this.prisma.agendamento.update({
            where: { id: str(args.agendamentoId) },
            data: {
              status: str(
                args.status,
              ) as import('@prisma/client').StatusAgendamento,
            },
            include: {
              cliente: { select: { nome: true } },
              pet: { select: { nome: true } },
              servicos: { include: { servico: { select: { nome: true } } } },
            },
          });
        }

        case 'criar_agendamento': {
          const servicoNomes = args.servicoNomes as string[];

          // Resolve service names to IDs for this tenant
          const servicosEncontrados = await this.prisma.servico.findMany({
            where: {
              tenantId,
              ativo: true,
              nome: { in: servicoNomes, mode: 'insensitive' },
            },
            select: { id: true, nome: true },
          });

          if (servicosEncontrados.length === 0) {
            return {
              erro: `Nenhum serviço encontrado com os nomes: ${servicoNomes.join(', ')}. Chame listar_servicos para ver os serviços disponíveis.`,
            };
          }

          const servicoIds = servicosEncontrados.map((s) => s.id);

          const modalidade =
            (args.modalidade as
              | import('@prisma/client').ModalidadeAgendamento
              | undefined) ?? 'ClienteTraz';

          // Auto-populate enderecoBusca from client address when PetshopBusca
          let enderecoBusca = optStr(args.enderecoBusca);
          if (modalidade === 'PetshopBusca' && !enderecoBusca) {
            const cliente = await this.prisma.cliente.findFirst({
              where: { id: str(args.clienteId), tenantId },
              select: {
                rua: true,
                numero: true,
                complemento: true,
                bairro: true,
                cidade: true,
                estado: true,
              },
            });
            if (cliente?.rua) {
              const partes = [
                cliente.rua,
                cliente.numero,
                cliente.complemento,
                cliente.bairro,
                cliente.cidade,
                cliente.estado,
              ].filter(Boolean);
              enderecoBusca = partes.join(', ');
            }
          }

          return await this.prisma.agendamento.create({
            data: {
              tenantId,
              clienteId: str(args.clienteId),
              petId: str(args.petId),
              dataHora: new Date(str(args.dataHora)),
              modalidade,
              enderecoBusca,
              observacoes: optStr(args.observacoes),
              status: 'Agendado',
              servicos: {
                createMany: {
                  data: servicoIds.map((id) => ({ servicoId: id })),
                },
              },
            },
            include: {
              cliente: { select: { nome: true } },
              pet: { select: { nome: true } },
              servicos: { include: { servico: { select: { nome: true } } } },
            },
          });
        }

        default:
          return { erro: `Ferramenta "${nome}" não reconhecida` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro na ferramenta ${nome}: ${msg}`);
      return { erro: msg };
    }
  }
}
