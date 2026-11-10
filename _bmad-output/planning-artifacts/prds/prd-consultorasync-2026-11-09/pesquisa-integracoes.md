# Pesquisa técnica para os requisitos — ConsultoraSync

Data documental: 09/11/2026, conforme contexto do usuário.

Esta pesquisa consulta documentação oficial da plataforma web e do Product Opener/Open Beauty Facts. Não validou contratos, APIs, formatos de pedido ou permissões de integração de Natura, Eudora ou O Boticário. Também não validou cobertura dos produtos dessas marcas nem fez teste operacional com câmeras ou consultas reais de seus códigos.

## 1. Câmera exige contexto seguro e permissão

**Fato verificado:** `getUserMedia()` exige contexto seguro e permissão da pessoa. A documentação cita HTTPS e exceções locais como `localhost`; sem contexto seguro, `navigator.mediaDevices` pode estar indisponível.

**Implicação para requisitos:** prever permissão negada, câmera indisponível e alternativa de digitação.

**Inferência para o cenário:** acessar o computador pelo celular via `http://192.168...` não recebe automaticamente a exceção de `localhost`. O teste deve planejar e verificar HTTPS confiável no dispositivo.

Fontes: [MDN — getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MDN — Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

## 2. Product Opener também atende Open Beauty Facts

**Fato verificado:** a documentação declara que Product Opener é o servidor dos projetos irmãos Beauty, Pet Food e Products Facts.

**Implicação para requisitos:** a documentação compartilhada serve à investigação técnica.

**Limite:** isso não demonstra disponibilidade, completude ou cobertura dos produtos brasileiros escolhidos.

Fonte: [Documentação oficial Product Opener](https://openfoodfacts.github.io/openfoodfacts-server/).

## 3. Consulta por código de barras e campos de produto

**Fato verificado:** a referência documenta `GET /api/v3/product/{code}`, seleção de campos e tipo de produto `beauty`. Prevê respostas 302 e 404. O esquema inclui nome, marca e estruturas de imagens.

**Implicação para requisitos:** tratar dados ausentes, produto não encontrado e redirecionamento; mostrar sugestões para confirmação antes de incorporá-las ao cadastro.

**Limite:** a presença de campos no esquema não garante seu preenchimento em cada produto.

Fonte: [Get Product Data](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/).

## 4. Limites sobre preço, custo e unidade física

**Constatação documental:** não foi localizado campo de preço na referência de consulta de produto examinada. Essa consulta descreve dados do produto identificado pelo código, não comprova custo efetivamente pago nem uma média de preços de mercado.

**Inferência para requisitos:** identificação e fotos podem ser pesquisadas, mas preço de venda, custo de compra, lote e validade da unidade exigem fontes ou registros próprios. Não tratar o código de barras como identificador exclusivo de cada unidade física.

**Limite:** esta constatação não demonstra que inexista outro serviço de preços; apenas não há base nesta fonte para prometer essa função.

Fonte: [Get Product Data](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/).

## 5. Qualidade dos dados e condições de uso

**Fato verificado:** a introdução da API informa que os dados são fornecidos voluntariamente e não oferece garantia de precisão, completude ou confiabilidade. Documenta identificação da aplicação, limites de uso e licenças distintas para banco, conteúdos e imagens.

**Implicação para requisitos:** pesquisa externa deve ser complementar, com tratamento de indisponibilidade, cache e identificação da fonte; verificar os termos e limites vigentes do serviço efetivamente utilizado antes de integrar.

**Limite:** não se adota aqui um limite numérico como compromisso do projeto nem se presume que toda regra operacional do Open Food Facts seja idêntica no servidor Open Beauty Facts.

Fonte: [Introdução oficial à API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/).
