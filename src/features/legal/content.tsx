import type { ReactNode } from 'react';
import { CONTACT_EMAIL, LEGAL_PATHS } from './routes';

// Os textos ficam fora do bundle inicial: só a página legal (chunk próprio) importa este módulo.

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface LegalText {
  title: string;
  summary: ReactNode;
  sections: LegalSection[];
}

function Mail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

function Basis({ purpose, basis }: { purpose: ReactNode; basis: ReactNode }) {
  return (
    <>
      <p>
        <strong>Finalidade:</strong> {purpose}
      </p>
      <p>
        <strong>Base legal:</strong> {basis}
      </p>
    </>
  );
}

export const PRIVACY: LegalText = {
  title: 'Política de Privacidade',
  summary: (
    <ul>
      <li>Coletamos apenas o necessário para criar e manter a sua conta: nome, e-mail e senha.</li>
      <li>Notificações e localização são opcionais e dependem da sua autorização.</li>
      <li>
        Não vendemos dados pessoais, não exibimos publicidade e não usamos cookies de rastreamento.
      </li>
      <li>
        Você pode baixar os seus dados ou excluir a sua conta a qualquer momento, no menu da conta.
      </li>
    </ul>
  ),
  sections: [
    {
      id: 'sobre',
      title: '1. Sobre esta Política',
      body: (
        <p>
          Esta Política explica como o Brasil Lens (brasillens.com.br) coleta, utiliza, armazena,
          compartilha e protege dados pessoais, em conformidade com a Lei Geral de Proteção de Dados
          Pessoais (Lei nº 13.709/2018, “LGPD”). Ela se aplica a todas as pessoas que acessam o site
          ou mantêm uma conta e deve ser lida em conjunto com os{' '}
          <a href={LEGAL_PATHS.terms}>Termos de Uso</a>.
        </p>
      ),
    },
    {
      id: 'controlador',
      title: '2. Controlador e canal de atendimento',
      body: (
        <>
          <p>
            O Brasil Lens é um projeto independente e gratuito, mantido por uma pessoa física
            residente no Brasil, que atua como controladora dos dados pessoais descritos nesta
            Política (“nós”).
          </p>
          <p>
            O canal oficial de atendimento a titulares de dados e à Autoridade Nacional de Proteção
            de Dados (ANPD) é o e-mail <Mail />. Como agente de tratamento de pequeno porte, o
            projeto está dispensado de indicar encarregado (Resolução CD/ANPD nº 2/2022, art. 11), e
            esse canal cumpre essa função. A identificação completa do controlador é fornecida, por
            esse mesmo canal, ao titular que a solicitar e às autoridades competentes.
          </p>
        </>
      ),
    },
    {
      id: 'dados',
      title: '3. Dados tratados, finalidades e bases legais',
      body: (
        <>
          <dl className="legal-data">
            <dt>Dados de cadastro</dt>
            <dd>
              <p>Nome, e-mail e senha.</p>
              <Basis
                purpose="criar a conta, autenticar o acesso e controlar quem utiliza os mapas. A senha é armazenada somente como hash criptográfico (scrypt) e não pode ser lida por ninguém, nem por nós."
                basis="execução de contrato (art. 7º, V)."
              />
            </dd>
            <dt>Preferências</dt>
            <dd>
              <p>
                Tema (claro ou escuro) e municípios acompanhados, com a data em que passaram a ser
                seguidos.
              </p>
              <Basis purpose="personalizar o serviço." basis="execução de contrato (art. 7º, V)." />
            </dd>
            <dt>Registro de aceite</dt>
            <dd>
              <p>Versão desta Política e dos Termos de Uso aceita por você e data do aceite.</p>
              <Basis
                purpose="comprovar a concordância com os documentos vigentes."
                basis="exercício regular de direitos (art. 7º, VI)."
              />
            </dd>
            <dt>Notificações (opcional)</dt>
            <dd>
              <p>
                Inscrição de push criada pelo navegador (endereço do serviço de notificações e
                chaves de criptografia), data da autorização para cada município e histórico dos
                avisos gerados para a sua conta.
              </p>
              <Basis
                purpose="enviar avisos meteorológicos oficiais dos municípios que você escolheu, sem repetições."
                basis="consentimento (art. 7º, I), que pode ser revogado a qualquer momento pelo sino do município ou nas configurações do navegador."
              />
            </dd>
            <dt>Localização (opcional)</dt>
            <dd>
              <p>
                Coordenadas do aparelho, enviadas uma única vez, quando você usa a função de
                localização. As coordenadas não são armazenadas.
              </p>
              <Basis
                purpose="identificar o município em que você está."
                basis="consentimento (art. 7º, I), concedido na permissão do navegador."
              />
            </dd>
            <dt>Registros técnicos</dt>
            <dd>
              <p>
                Endereço IP, data e hora, rota acessada e tipo de navegador, registrados pelos
                provedores de hospedagem. O IP também é mantido na memória do servidor por até cinco
                minutos, para limitar tentativas de acesso.
              </p>
              <Basis
                purpose="garantir a segurança, prevenir fraudes e abusos e diagnosticar falhas."
                basis="legítimo interesse (art. 7º, IX)."
              />
            </dd>
            <dt>Doações por Pix</dt>
            <dd>
              <p>
                Nome de quem doa, informado pela instituição financeira, como em qualquer
                transferência Pix. Esse dado não é associado a contas do Brasil Lens.
              </p>
              <Basis
                purpose="controle financeiro e cumprimento de obrigações fiscais."
                basis="cumprimento de obrigação legal (art. 7º, II)."
              />
            </dd>
          </dl>
          <p>
            Não coletamos CPF, telefone, endereço nem dados pessoais sensíveis, não vendemos nem
            alugamos dados pessoais e não os utilizamos para publicidade ou criação de perfis.
          </p>
        </>
      ),
    },
    {
      id: 'cookies',
      title: '4. Cookies e armazenamento local',
      body: (
        <>
          <p>
            Usamos um único cookie, estritamente necessário: <code>brasil_lens_session</code>, que
            mantém você conectado por até 30 dias. Ele contém um código aleatório, é inacessível aos
            scripts da página e, no servidor, apenas o resumo criptográfico desse código é guardado.
            Não usamos cookies de publicidade nem ferramentas de análise de terceiros.
          </p>
          <p>
            O tema escolhido e o último recorte do mapa ficam no armazenamento local do navegador e
            não saem do seu aparelho.
          </p>
        </>
      ),
    },
    {
      id: 'compartilhamento',
      title: '5. Compartilhamento de dados',
      body: (
        <>
          <p>
            Os dados são compartilhados apenas com os fornecedores necessários ao funcionamento do
            serviço, que atuam como operadores, em nosso nome e de acordo com as nossas instruções:
          </p>
          <ul>
            <li>
              <strong>Vercel:</strong> hospedagem do site e encaminhamento das requisições.
            </li>
            <li>
              <strong>Render:</strong> execução da API.
            </li>
            <li>
              <strong>Neon (Amazon Web Services):</strong> hospedagem do banco de dados.
            </li>
            <li>
              <strong>GitHub:</strong> execução da rotina periódica de envio de avisos.
            </li>
            <li>
              <strong>Serviços de push dos navegadores</strong> (Google, Apple, Mozilla e
              Microsoft): entrega das notificações, que recebem já criptografadas.
            </li>
          </ul>
          <p>
            Para exibir o mapa, o navegador carrega imagens diretamente da Esri (relevo) e do INPE
            (focos de calor). Esses serviços recebem o seu endereço IP, como ocorre com qualquer
            conteúdo de terceiros incorporado a um site.
          </p>
          <p>
            Dados pessoais também podem ser fornecidos a autoridades públicas quando houver
            obrigação legal ou ordem judicial.
          </p>
        </>
      ),
    },
    {
      id: 'transferencia',
      title: '6. Transferência internacional',
      body: (
        <p>
          A API e o banco de dados estão hospedados em servidores nos Estados Unidos. A
          transferência é necessária para a execução do serviço que você contratou (art. 33, IX,
          combinado com o art. 7º, V, da LGPD) e ocorre com fornecedores que adotam salvaguardas
          contratuais e técnicas de proteção de dados.
        </p>
      ),
    },
    {
      id: 'retencao',
      title: '7. Retenção e eliminação',
      body: (
        <ul>
          <li>Dados de cadastro, preferências e registro de aceite: até a exclusão da conta.</li>
          <li>Sessões: 30 dias ou até você sair da conta, o que ocorrer primeiro.</li>
          <li>
            Inscrições de push: até você desativar as notificações, sair ou excluir a conta, ou até
            o serviço do navegador invalidar a inscrição.
          </li>
          <li>Histórico de avisos: eliminado 30 dias após o fim da vigência de cada aviso.</li>
          <li>
            Endereço IP para limitar tentativas de acesso: até cinco minutos, apenas em memória.
          </li>
          <li>
            Registros técnicos dos provedores: pelo prazo de retenção de cada provedor, geralmente
            de alguns dias a poucas semanas.
          </li>
        </ul>
      ),
    },
    {
      id: 'direitos',
      title: '8. Direitos do titular',
      body: (
        <>
          <p>Nos termos do art. 18 da LGPD, você pode solicitar, a qualquer momento:</p>
          <ul>
            <li>confirmação da existência de tratamento e acesso aos dados;</li>
            <li>correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li>portabilidade dos dados;</li>
            <li>eliminação dos dados tratados com base no consentimento;</li>
            <li>informação sobre as entidades com as quais os dados são compartilhados;</li>
            <li>revogação do consentimento.</li>
          </ul>
          <p>
            No menu da conta, você mesmo <strong>baixa todos os seus dados</strong> (arquivo JSON) e{' '}
            <strong>exclui a conta</strong>. A exclusão elimina imediatamente a conta, as sessões,
            os municípios acompanhados, as inscrições de push e o histórico de avisos. Cópias de
            segurança automáticas do banco de dados podem conservar esses dados por alguns dias, até
            serem sobrescritas.
          </p>
          <p>
            Os demais pedidos devem ser enviados para <Mail /> a partir do e-mail cadastrado na
            conta, para que possamos confirmar a sua identidade. Respondemos em até 15 dias. Você
            também pode apresentar reclamação à ANPD, em gov.br/anpd.
          </p>
        </>
      ),
    },
    {
      id: 'seguranca',
      title: '9. Segurança da informação',
      body: (
        <p>
          Toda a comunicação é feita por conexão criptografada (HTTPS). Senhas e códigos de sessão
          são armazenados somente como resumos criptográficos, o cookie de sessão é inacessível aos
          scripts e as tentativas de acesso são limitadas. Nenhum sistema é totalmente imune a
          falhas: em caso de incidente de segurança que possa acarretar risco ou dano relevante,
          você e a ANPD serão comunicados, nos termos do art. 48 da LGPD.
        </p>
      ),
    },
    {
      id: 'menores',
      title: '10. Crianças e adolescentes',
      body: (
        <p>
          O Brasil Lens não é direcionado a crianças. A criação de conta exige idade mínima de 18
          anos ou autorização do responsável legal. Contas de crianças criadas sem essa autorização
          serão excluídas assim que identificadas, e os responsáveis podem solicitar a exclusão por{' '}
          <Mail />.
        </p>
      ),
    },
    {
      id: 'alteracoes',
      title: '11. Alterações desta Política',
      body: (
        <p>
          Esta Política pode ser atualizada, e a data da última atualização aparece no topo da
          página. Alterações relevantes, como novos dados, finalidades ou operadores, serão
          comunicadas no aplicativo e exigirão um novo aceite para o uso da conta.
        </p>
      ),
    },
  ],
};

export const TERMS: LegalText = {
  title: 'Termos de Uso',
  summary: (
    <ul>
      <li>O Brasil Lens é um serviço gratuito de consulta a dados públicos oficiais em mapas.</li>
      <li>
        As informações têm caráter informativo e não substituem os canais oficiais. Em emergências,
        ligue 199 (Defesa Civil) ou 193 (Corpo de Bombeiros).
      </li>
      <li>
        O acesso aos mapas exige uma conta pessoal e intransferível, que pode ser suspensa em caso
        de uso indevido.
      </li>
      <li>As doações são voluntárias e não geram nenhuma contrapartida.</li>
    </ul>
  ),
  sections: [
    {
      id: 'aceitacao',
      title: '1. Aceitação',
      body: (
        <p>
          Estes Termos regulam o acesso e o uso do Brasil Lens (brasillens.com.br). Ao criar uma
          conta ou continuar a utilizá-la, você declara ter lido, compreendido e aceitado estes
          Termos e a <a href={LEGAL_PATHS.privacy}>Política de Privacidade</a>. Se não concordar com
          eles, não utilize o serviço.
        </p>
      ),
    },
    {
      id: 'servico',
      title: '2. O serviço',
      body: (
        <p>
          O Brasil Lens é um projeto independente e gratuito, mantido por uma pessoa física, que
          reúne em mapas interativos dados públicos sobre clima, meio ambiente, socioeconomia,
          eleições, transporte e educação no Brasil, do país ao município. Funcionalidades e
          conjuntos de dados podem ser incluídos, alterados ou removidos a qualquer tempo.
        </p>
      ),
    },
    {
      id: 'conta',
      title: '3. Cadastro e conta',
      body: (
        <ul>
          <li>
            O acesso aos mapas exige uma conta pessoal e intransferível. A criação de conta exige
            idade mínima de 18 anos ou autorização do responsável legal.
          </li>
          <li>Você se compromete a informar dados verdadeiros e a manter a sua senha em sigilo.</li>
          <li>
            Você é responsável pelas atividades realizadas na sua conta e deve comunicar qualquer
            suspeita de uso não autorizado por <Mail />.
          </li>
        </ul>
      ),
    },
    {
      id: 'condutas',
      title: '4. Condutas vedadas',
      body: (
        <>
          <p>Ao utilizar o Brasil Lens, é vedado:</p>
          <ul>
            <li>
              acessar o serviço por meios automatizados ou em volume que prejudique o seu
              funcionamento (os dados exibidos podem ser obtidos diretamente nas fontes oficiais);
            </li>
            <li>
              tentar contornar a autenticação, os limites de acesso ou outros mecanismos de
              segurança, ou explorar vulnerabilidades (se identificar alguma, comunique-a por{' '}
              <Mail />
              );
            </li>
            <li>utilizar a conta de terceiros ou fazer-se passar por outra pessoa;</li>
            <li>utilizar o serviço para qualquer finalidade ilícita.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'informacoes',
      title: '5. Natureza das informações',
      body: (
        <>
          <p>
            Os dados provêm de fontes públicas, como IBGE, INMET, CEMADEN, INPE, ANA, TSE, INEP,
            MMA, ICMBio, ANM, SGB, ANP, MapBiomas, GBIF, Open-Meteo e OpenStreetMap, e são exibidos
            com a indicação da respectiva fonte. Valores estimados são identificados com o símbolo
            “≈”. As fontes podem apresentar atrasos, alterações, indisponibilidades ou erros, que se
            refletem no serviço.
          </p>
          <p>
            <strong>
              As informações têm caráter exclusivamente informativo e não substituem os alertas e as
              orientações dos órgãos oficiais.
            </strong>{' '}
            Em emergências, ligue 199 (Defesa Civil) ou 193 (Corpo de Bombeiros) e siga as
            orientações das autoridades locais. Para receber os alertas oficiais da Defesa Civil por
            SMS, envie o seu CEP para 40199. As notificações do Brasil Lens podem atrasar ou não ser
            entregues.
          </p>
          <p>
            Os resultados eleitorais correspondem aos dados divulgados pelo Tribunal Superior
            Eleitoral e são apresentados sem recomendação de voto nem apoio a candidatos ou
            partidos.
          </p>
        </>
      ),
    },
    {
      id: 'disponibilidade',
      title: '6. Disponibilidade',
      body: (
        <p>
          O serviço é oferecido no estado em que se encontra e pode ser interrompido para
          manutenção, por falhas técnicas ou por indisponibilidade de fornecedores e fontes. Em caso
          de descontinuidade definitiva, as contas serão avisadas com antecedência razoável.
        </p>
      ),
    },
    {
      id: 'responsabilidade',
      title: '7. Limitação de responsabilidade',
      body: (
        <p>
          As decisões tomadas com base no Brasil Lens são de responsabilidade de quem as toma. O
          projeto não responde por falhas, atrasos ou imprecisões das fontes oficiais e de serviços
          de terceiros, nem por decisões tomadas exclusivamente com base nas informações exibidas,
          ressalvados os direitos assegurados pela legislação aplicável.
        </p>
      ),
    },
    {
      id: 'propriedade',
      title: '8. Propriedade intelectual e licenças',
      body: (
        <p>
          Os dados pertencem às respectivas fontes e são utilizados conforme as licenças de cada
          uma, como a CC BY 4.0 (MapBiomas, Open-Meteo e parte dos registros do GBIF) e a ODbL
          (OpenStreetMap), com a atribuição exibida no mapa. O nome e a identidade visual do Brasil
          Lens pertencem ao projeto. O código-fonte é público no GitHub, e o seu uso está sujeito à
          licença indicada em cada repositório.
        </p>
      ),
    },
    {
      id: 'doacoes',
      title: '9. Doações',
      body: (
        <p>
          As doações são feitas por Pix diretamente ao mantenedor do projeto, pessoa física, têm
          caráter voluntário e valor livre e destinam-se ao custeio da infraestrutura (servidores,
          banco de dados e domínio). Elas não conferem benefício, recurso exclusivo ou qualquer
          outra contrapartida, não são dedutíveis do Imposto de Renda e não são reembolsáveis, salvo
          em caso de erro comprovado, comunicado por <Mail />.
        </p>
      ),
    },
    {
      id: 'encerramento',
      title: '10. Suspensão e encerramento',
      body: (
        <p>
          Você pode excluir a sua conta a qualquer momento, no menu da conta. O projeto pode
          limitar, suspender ou encerrar contas que violem estes Termos, coloquem o serviço em risco
          ou cujo encerramento seja exigido por determinação legal, com aviso prévio sempre que
          possível.
        </p>
      ),
    },
    {
      id: 'alteracoes',
      title: '11. Alterações dos Termos',
      body: (
        <p>
          Estes Termos podem ser atualizados, e a data da última atualização aparece no topo da
          página. Alterações relevantes serão comunicadas no aplicativo e exigirão um novo aceite;
          caso não concorde, você pode excluir a sua conta.
        </p>
      ),
    },
    {
      id: 'foro',
      title: '12. Legislação aplicável e foro',
      body: (
        <p>
          Estes Termos são regidos pela legislação brasileira. Fica eleito o foro do domicílio do
          usuário para dirimir eventuais controvérsias.
        </p>
      ),
    },
    {
      id: 'contato',
      title: '13. Contato',
      body: (
        <p>
          Dúvidas, solicitações e comunicações relacionadas a estes Termos devem ser enviadas para{' '}
          <Mail />.
        </p>
      ),
    },
  ],
};
