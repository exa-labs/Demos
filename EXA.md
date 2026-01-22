# Search

> The search endpoint lets you intelligently search the web and extract contents from the results. 

By default, it automatically chooses the best search method using Exa's embeddings-based model and other techniques to find the most relevant results for your query. You can also use Deep search for comprehensive results with query expansion and detailed context.

<Card title="Get your Exa API key" icon="key" horizontal href="https://dashboard.exa.ai/api-keys" />


## OpenAPI

````yaml post /search
openapi: 3.1.0
info:
  version: 1.2.0
  title: Exa Search API
  description: >-
    A comprehensive API for internet-scale search, allowing users to perform
    queries and retrieve results from a wide variety of sources using
    embeddings-based and traditional search.
servers:
  - url: https://api.exa.ai
security:
  - apikey: []
paths:
  /search:
    post:
      summary: Search
      description: >-
        Perform a search with a Exa prompt-engineered query and retrieve a list
        of relevant results. Optionally get contents.
      operationId: search
      requestBody:
        required: true
        content:
          application/json:
            schema:
              allOf:
                - type: object
                  properties:
                    query:
                      type: string
                      example: Latest developments in LLM capabilities
                      default: Latest developments in LLM capabilities
                      description: The query string for the search.
                    additionalQueries:
                      type: array
                      items:
                        type: string
                      description: >-
                        Additional query variations for deep search. Only works
                        with type="deep". When provided, these queries are used
                        alongside the main query for comprehensive results.
                      example:
                        - LLM advancements
                        - large language model progress
                    type:
                      type: string
                      enum:
                        - neural
                        - fast
                        - auto
                        - deep
                      description: >-
                        The type of search. Neural uses an embeddings-based
                        model, auto (default) intelligently combines neural and
                        other search methods, fast uses streamlined versions of
                        the search models, and deep provides comprehensive
                        search with query expansion and detailed context.
                      example: auto
                      default: auto
                    category:
                      type: string
                      enum:
                        - company
                        - research paper
                        - news
                        - pdf
                        - github
                        - tweet
                        - personal site
                        - financial report
                        - people
                      description: >-
                        A data category to focus on. The `people` and `company`
                        categories have improved quality for finding LinkedIn
                        profiles and company pages. Note: The `company` and
                        `people` categories only support a limited set of
                        filters. The following parameters are NOT supported for
                        these categories: `startPublishedDate`,
                        `endPublishedDate`, `startCrawlDate`, `endCrawlDate`,
                        `includeText`, `excludeText`, `excludeDomains`. For
                        `people` category, `includeDomains` only accepts
                        LinkedIn domains. Using unsupported parameters will
                        result in a 400 error.
                      example: research paper
                    userLocation:
                      type: string
                      description: The two-letter ISO country code of the user, e.g. US.
                      example: US
                  required:
                    - query
                - $ref: '#/components/schemas/CommonRequest'
      responses:
        '200':
          $ref: '#/components/responses/SearchResponse'
components:
  schemas:
    CommonRequest:
      type: object
      properties:
        numResults:
          type: integer
          maximum: 100
          default: 10
          description: >
            Number of results to return. Limits vary by search type:

            - With "neural": max 100 results

            - With "deep": max 100 results


            If you want to increase the num results beyond these limits, contact
            sales (hello@exa.ai)
          example: 10
        includeDomains:
          type: array
          maxItems: 1200
          items:
            type: string
          description: >-
            List of domains to include in the search. If specified, results will
            only come from these domains.
          example:
            - arxiv.org
            - paperswithcode.com
        excludeDomains:
          type: array
          maxItems: 1200
          items:
            type: string
          description: >-
            List of domains to exclude from search results. If specified, no
            results will be returned from these domains.
        startCrawlDate:
          type: string
          format: date-time
          description: >-
            Crawl date refers to the date that Exa discovered a link. Results
            will include links that were crawled after this date. Must be
            specified in ISO 8601 format.
          example: '2023-01-01T00:00:00.000Z'
        endCrawlDate:
          type: string
          format: date-time
          description: >-
            Crawl date refers to the date that Exa discovered a link. Results
            will include links that were crawled before this date. Must be
            specified in ISO 8601 format.
          example: '2023-12-31T00:00:00.000Z'
        startPublishedDate:
          type: string
          format: date-time
          description: >-
            Only links with a published date after this will be returned. Must
            be specified in ISO 8601 format.
          example: '2023-01-01T00:00:00.000Z'
        endPublishedDate:
          type: string
          format: date-time
          description: >-
            Only links with a published date before this will be returned. Must
            be specified in ISO 8601 format.
          example: '2023-12-31T00:00:00.000Z'
        includeText:
          type: array
          items:
            type: string
          description: >-
            List of strings that must be present in webpage text of results.
            Currently, only 1 string is supported, of up to 5 words.
          example:
            - large language model
        excludeText:
          type: array
          items:
            type: string
          description: >-
            List of strings that must not be present in webpage text of results.
            Currently, only 1 string is supported, of up to 5 words. Checks from
            the first 1000 words of the webpage text.
          example:
            - course
        context:
          oneOf:
            - type: boolean
              description: >-
                Return page contents as a context string for LLM. When true,
                combines all result contents into one string. We recommend using
                10000+ characters for best results, though no limit works best.
                Context strings often perform better than highlights for RAG
                applications.
              example: true
            - type: object
              description: >-
                Return page contents as a context string for LLM. When true,
                combines all result contents into one string. We recommend using
                10000+ characters for best results, though no limit works best.
                Context strings often perform better than highlights for RAG
                applications.
              properties:
                maxCharacters:
                  type: integer
                  description: >-
                    Maximum character limit for the context string. If you have
                    5 results and set 1000 characters, each result gets about
                    200 characters. We recommend 10000+ characters for best
                    performance.
                  example: 10000
        moderation:
          type: boolean
          default: false
          description: >-
            Enable content moderation to filter unsafe content from search
            results.
          example: true
        contents:
          $ref: '#/components/schemas/ContentsRequest'
    ContentsRequest:
      type: object
      properties:
        text:
          oneOf:
            - type: boolean
              title: Simple text retrieval
              description: >-
                If true, returns full page text with default settings. If false,
                disables text return.
            - type: object
              title: Advanced text options
              description: >-
                Advanced options for controlling text extraction. Use this when
                you need to limit text length or include HTML structure.
              properties:
                maxCharacters:
                  type: integer
                  description: >-
                    Maximum character limit for the full page text. Useful for
                    controlling response size and API costs.
                  example: 1000
                includeHtmlTags:
                  type: boolean
                  default: false
                  description: >-
                    Include HTML tags in the response, which can help LLMs
                    understand text structure and formatting.
                  example: false
        highlights:
          type: object
          description: Text snippets the LLM identifies as most relevant from each page.
          properties:
            numSentences:
              type: integer
              minimum: 1
              description: The number of sentences to return for each snippet.
              example: 1
            highlightsPerUrl:
              type: integer
              minimum: 1
              description: The number of snippets to return for each result.
              example: 1
            query:
              type: string
              description: Custom query to direct the LLM's selection of highlights.
              example: Key advancements
        summary:
          type: object
          description: Summary of the webpage
          properties:
            query:
              type: string
              description: Custom query for the LLM-generated summary.
              example: Main developments
            schema:
              type: object
              description: >
                JSON schema for structured output from summary. 

                See https://json-schema.org/overview/what-is-jsonschema for JSON
                Schema documentation.
              example:
                $schema: http://json-schema.org/draft-07/schema#
                title: Title
                type: object
                properties:
                  Property 1:
                    type: string
                    description: Description
                  Property 2:
                    type: string
                    enum:
                      - option 1
                      - option 2
                      - option 3
                    description: Description
                required:
                  - Property 1
        livecrawl:
          type: string
          enum:
            - never
            - fallback
            - preferred
            - always
          description: >
            Options for livecrawling pages.

            'never': Disable livecrawling (default for neural search).

            'fallback': Livecrawl when cache is empty.

            'preferred': Always try to livecrawl, but fall back to cache if
            crawling fails.

            'always': Always live-crawl, never use cache. Only use if you cannot
            tolerate any cached content. This option is not recommended unless
            consulted with the Exa team.
          example: preferred
        livecrawlTimeout:
          type: integer
          default: 10000
          description: The timeout for livecrawling in milliseconds.
          example: 1000
        subpages:
          type: integer
          default: 0
          description: >-
            The number of subpages to crawl. The actual number crawled may be
            limited by system constraints.
          example: 1
        subpageTarget:
          oneOf:
            - type: string
            - type: array
              items:
                type: string
          description: >-
            Term to find specific subpages of search results. Can be a single
            string or an array of strings, comma delimited.
          example: sources
        extras:
          type: object
          description: Extra parameters to pass.
          properties:
            links:
              type: integer
              default: 0
              description: Number of URLs to return from each webpage.
              example: 1
            imageLinks:
              type: integer
              default: 0
              description: Number of images to return for each result.
              example: 1
        context:
          oneOf:
            - type: boolean
              description: >-
                Return page contents as a context string for LLM. When true,
                combines all result contents into one string. We recommend using
                10000+ characters for best results, though no limit works best.
                Context strings often perform better than highlights for RAG
                applications.
              example: true
            - type: object
              description: >-
                Return page contents as a context string for LLM. When true,
                combines all result contents into one string. We recommend using
                10000+ characters for best results, though no limit works best.
                Context strings often perform better than highlights for RAG
                applications.
              properties:
                maxCharacters:
                  type: integer
                  description: >-
                    Maximum character limit for the context string. If you have
                    5 results and set 1000 characters, each result gets about
                    200 characters. We recommend 10000+ characters for best
                    performance.
                  example: 10000
    ResultWithContent:
      allOf:
        - $ref: '#/components/schemas/Result'
        - type: object
          properties:
            text:
              type: string
              description: The full content text of the search result.
              example: >-
                Abstract Large Language Models (LLMs) have recently demonstrated
                remarkable capabilities...
            highlights:
              type: array
              items:
                type: string
              description: Array of highlights extracted from the search result content.
              example:
                - Such requirements have limited their adoption...
            highlightScores:
              type: array
              items:
                type: number
                format: float
              description: Array of cosine similarity scores for each highlighted
              example:
                - 0.4600165784358978
            summary:
              type: string
              description: Summary of the webpage
              example: >-
                This overview paper on Large Language Models (LLMs) highlights
                key developments...
            subpages:
              type: array
              items:
                $ref: '#/components/schemas/ResultWithContent'
              description: Array of subpages for the search result.
              example:
                - id: https://arxiv.org/abs/2303.17580
                  url: https://arxiv.org/pdf/2303.17580.pdf
                  title: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face
                  author: >-
                    Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                    Microsoft Research Asia, Xu  Tan, Microsoft Research Asia,
                    Dongsheng  Li, Microsoft Research Asia, Weiming  Lu,
                    Microsoft Research Asia, Yueting  Zhuang, Microsoft Research
                    Asia, yzhuang@zju.edu.cn, Zhejiang  University, Microsoft
                    Research Asia, Microsoft  Research, Microsoft Research Asia
                  publishedDate: '2023-11-16T01:36:20.486Z'
                  text: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face Date Published: 2023-05-25 Authors: Yongliang
                    Shen, Microsoft Research Asia Kaitao Song, Microsoft
                    Research Asia Xu Tan, Microsoft Research Asia Dongsheng Li,
                    Microsoft Research Asia Weiming Lu, Microsoft Research Asia
                    Yueting Zhuang, Microsoft Research Asia, yzhuang@zju.edu.cn
                    Zhejiang University, Microsoft Research Asia Microsoft
                    Research, Microsoft Research Asia Abstract Solving
                    complicated AI tasks with different domains and modalities
                    is a key step toward artificial general intelligence. While
                    there are abundant AI models available for different domains
                    and modalities, they cannot handle complicated AI tasks.
                    Considering large language models (LLMs) have exhibited
                    exceptional ability in language understanding, generation,
                    interaction, and reasoning, we advocate that LLMs could act
                    as a controller to manage existing AI models to solve
                    complicated AI tasks and language could be a generic
                    interface to empower t
                  summary: >-
                    HuggingGPT is a framework using ChatGPT as a central
                    controller to orchestrate various AI models from Hugging
                    Face to solve complex tasks. ChatGPT plans the task, selects
                    appropriate models based on their descriptions, executes
                    subtasks, and summarizes the results. This approach
                    addresses limitations of LLMs by allowing them to handle
                    multimodal data (vision, speech) and coordinate multiple
                    models for complex tasks, paving the way for more advanced
                    AI systems.
                  highlights:
                    - >-
                      2) Recently, some researchers started to investigate the
                      integration of using tools or models in LLMs  .
                  highlightScores:
                    - 0.32679107785224915
            extras:
              type: object
              description: Results from extras.
              properties:
                links:
                  type: array
                  items:
                    type: string
                  description: Array of links from the search result.
                  example: []
    CostDollars:
      type: object
      properties:
        total:
          type: number
          format: float
          description: Total dollar cost for your request
          example: 0.005
        breakDown:
          type: array
          description: Breakdown of costs by operation type
          items:
            type: object
            properties:
              search:
                type: number
                format: float
                description: Cost of your search operations
                example: 0.005
              contents:
                type: number
                format: float
                description: Cost of your content operations
                example: 0
              breakdown:
                type: object
                properties:
                  neuralSearch:
                    type: number
                    format: float
                    description: Cost of your neural search operations
                    example: 0.005
                  deepSearch:
                    type: number
                    format: float
                    description: Cost of your deep search operations
                    example: 0.015
                  contentText:
                    type: number
                    format: float
                    description: Cost of your text content retrieval
                    example: 0
                  contentHighlight:
                    type: number
                    format: float
                    description: Cost of your highlight generation
                    example: 0
                  contentSummary:
                    type: number
                    format: float
                    description: Cost of your summary generation
                    example: 0
        perRequestPrices:
          type: object
          description: Standard price per request for different operations
          properties:
            neuralSearch_1_25_results:
              type: number
              format: float
              description: Standard price for neural search with 1-25 results
              example: 0.005
            neuralSearch_26_100_results:
              type: number
              format: float
              description: Standard price for neural search with 26-100 results
              example: 0.025
            neuralSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for neural search with 100+ results
              example: 1
            deepSearch_1_25_results:
              type: number
              format: float
              description: Standard price for deep search with 1-25 results
              example: 0.015
            deepSearch_26_100_results:
              type: number
              format: float
              description: Standard price for deep search with 26-100 results
              example: 0.075
        perPagePrices:
          type: object
          description: Standard price per page for different content operations
          properties:
            contentText:
              type: number
              format: float
              description: Standard price per page for text content
              example: 0.001
            contentHighlight:
              type: number
              format: float
              description: Standard price per page for highlights
              example: 0.001
            contentSummary:
              type: number
              format: float
              description: Standard price per page for summaries
              example: 0.001
    Result:
      type: object
      properties:
        title:
          type: string
          description: The title of the search result.
          example: A Comprehensive Overview of Large Language Models
        url:
          type: string
          format: uri
          description: The URL of the search result.
          example: https://arxiv.org/pdf/2307.06435.pdf
        publishedDate:
          type: string
          nullable: true
          description: >-
            An estimate of the creation date, from parsing HTML content. Format
            is YYYY-MM-DD.
          example: '2023-11-16T01:36:32.547Z'
        author:
          type: string
          nullable: true
          description: If available, the author of the content.
          example: >-
            Humza  Naveed, University of Engineering and Technology (UET),
            Lahore, Pakistan
        id:
          type: string
          description: The temporary ID for the document. Useful for /contents endpoint.
          example: https://arxiv.org/abs/2307.06435
        image:
          type: string
          format: uri
          description: The URL of an image associated with the search result, if available.
          example: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
        favicon:
          type: string
          format: uri
          description: The URL of the favicon for the search result's domain.
          example: https://arxiv.org/favicon.ico
  responses:
    SearchResponse:
      description: OK
      content:
        application/json:
          schema:
            type: object
            properties:
              requestId:
                type: string
                description: Unique identifier for the request
                example: b5947044c4b78efa9552a7c89b306d95
              results:
                type: array
                description: >-
                  A list of search results containing title, URL, published
                  date, and author.
                items:
                  $ref: '#/components/schemas/ResultWithContent'
              searchType:
                type: string
                enum:
                  - neural
                  - deep
                description: For auto searches, indicates which search type was selected.
                example: auto
              context:
                type: string
                description: >-
                  Return page contents as a context string for LLM. When true,
                  combines all result contents into one string. Context strings
                  often perform better than highlights for LLMs.
              costDollars:
                $ref: '#/components/schemas/CostDollars'
  securitySchemes:
    apikey:
      type: apiKey
      name: x-api-key
      in: header
      description: >-
        API key can be provided either via x-api-key header or Authorization
        header with Bearer scheme

````

---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://exa.ai/docs/llms.txt


######## Answer endpoint

# Answer

> Get an LLM answer to a question informed by Exa search results. `/answer` performs an Exa search and uses an LLM to generate either:
1. A direct answer for specific queries. (i.e. "What is the capital of France?" would return "Paris")
2. A detailed summary with citations for open-ended queries (i.e. "What is the state of ai in healthcare?" would return a summary with citations to relevant sources)

The response includes both the generated answer and the sources used to create it. The endpoint also supports streaming (as `stream=True`), which will return tokens as they are generated.

Alternatively, you can use the OpenAI compatible [chat completions interface](https://docs.exa.ai/reference/chat-completions#answer).


<Card title="Get your Exa API key" icon="key" horizontal href="https://dashboard.exa.ai/api-keys" />

<Info>
  Need custom output formats or specialized behavior from `/answer`? Reach out to [hello@exa.ai](mailto:hello@exa.ai) and we can help tailor the endpoint to your use case.
</Info>


## OpenAPI

````yaml post /answer
openapi: 3.1.0
info:
  version: 1.2.0
  title: Exa Search API
  description: >-
    A comprehensive API for internet-scale search, allowing users to perform
    queries and retrieve results from a wide variety of sources using
    embeddings-based and traditional search.
servers:
  - url: https://api.exa.ai
security:
  - apikey: []
paths:
  /answer:
    post:
      summary: Generate an answer from search results
      description: >
        Performs a search based on the query and generates either a direct
        answer or a detailed summary with citations, depending on the query
        type.
      operationId: answer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - query
              properties:
                query:
                  type: string
                  description: The question or query to answer.
                  example: What is the latest valuation of SpaceX?
                  default: What is the latest valuation of SpaceX?
                  minLength: 1
                stream:
                  type: boolean
                  default: false
                  description: >-
                    If true, the response is returned as a server-sent events
                    (SSS) stream.
                text:
                  type: boolean
                  default: false
                  description: >-
                    If true, the response includes full text content in the
                    search results
      responses:
        '200':
          $ref: '#/components/responses/AnswerResponse'
components:
  responses:
    AnswerResponse:
      description: OK
      content:
        application/json:
          schema:
            allOf:
              - $ref: '#/components/schemas/AnswerResult'
              - type: object
                properties:
                  costDollars:
                    $ref: '#/components/schemas/CostDollars'
        text/event-stream:
          schema:
            type: object
            properties:
              answer:
                type: string
                description: Partial answer chunk when streaming is enabled.
              citations:
                type: array
                items:
                  $ref: '#/components/schemas/AnswerCitation'
  schemas:
    AnswerResult:
      type: object
      properties:
        answer:
          type: string
          description: The generated answer based on search results.
          example: $350 billion.
        citations:
          type: array
          description: Search results used to generate the answer.
          items:
            $ref: '#/components/schemas/AnswerCitation'
    CostDollars:
      type: object
      properties:
        total:
          type: number
          format: float
          description: Total dollar cost for your request
          example: 0.005
        breakDown:
          type: array
          description: Breakdown of costs by operation type
          items:
            type: object
            properties:
              search:
                type: number
                format: float
                description: Cost of your search operations
                example: 0.005
              contents:
                type: number
                format: float
                description: Cost of your content operations
                example: 0
              breakdown:
                type: object
                properties:
                  neuralSearch:
                    type: number
                    format: float
                    description: Cost of your neural search operations
                    example: 0.005
                  deepSearch:
                    type: number
                    format: float
                    description: Cost of your deep search operations
                    example: 0.015
                  contentText:
                    type: number
                    format: float
                    description: Cost of your text content retrieval
                    example: 0
                  contentHighlight:
                    type: number
                    format: float
                    description: Cost of your highlight generation
                    example: 0
                  contentSummary:
                    type: number
                    format: float
                    description: Cost of your summary generation
                    example: 0
        perRequestPrices:
          type: object
          description: Standard price per request for different operations
          properties:
            neuralSearch_1_25_results:
              type: number
              format: float
              description: Standard price for neural search with 1-25 results
              example: 0.005
            neuralSearch_26_100_results:
              type: number
              format: float
              description: Standard price for neural search with 26-100 results
              example: 0.025
            neuralSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for neural search with 100+ results
              example: 1
            deepSearch_1_25_results:
              type: number
              format: float
              description: Standard price for deep search with 1-25 results
              example: 0.015
            deepSearch_26_100_results:
              type: number
              format: float
              description: Standard price for deep search with 26-100 results
              example: 0.075
        perPagePrices:
          type: object
          description: Standard price per page for different content operations
          properties:
            contentText:
              type: number
              format: float
              description: Standard price per page for text content
              example: 0.001
            contentHighlight:
              type: number
              format: float
              description: Standard price per page for highlights
              example: 0.001
            contentSummary:
              type: number
              format: float
              description: Standard price per page for summaries
              example: 0.001
    AnswerCitation:
      type: object
      properties:
        id:
          type: string
          description: The temporary ID for the document.
          example: >-
            https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
        url:
          type: string
          format: uri
          description: The URL of the search result.
          example: >-
            https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
        title:
          type: string
          description: The title of the search result.
          example: SpaceX valued at $350bn as company agrees to buy shares from ...
        author:
          type: string
          nullable: true
          description: If available, the author of the content.
          example: Dan Milmon
        publishedDate:
          type: string
          nullable: true
          description: >-
            An estimate of the creation date, from parsing HTML content. Format
            is YYYY-MM-DD.
          example: '2023-11-16T01:36:32.547Z'
        text:
          type: string
          description: >-
            The full text content of each source. Only present when includeText
            is enabled.
          example: SpaceX valued at $350bn as company agrees to buy shares from ...
        image:
          type: string
          format: uri
          description: >-
            The URL of the image associated with the search result, if
            available.
          example: >-
            https://i.guim.co.uk/img/media/7cfee7e84b24b73c97a079c402642a333ad31e77/0_380_6176_3706/master/6176.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=71ebb2fbf458c185229d02d380c01530
        favicon:
          type: string
          format: uri
          description: The URL of the favicon for the search result's domain, if available.
          example: >-
            https://assets.guim.co.uk/static/frontend/icons/homescreen/apple-touch-icon.svg
  securitySchemes:
    apikey:
      type: apiKey
      name: x-api-key
      in: header
      description: >-
        API key can be provided either via x-api-key header or Authorization
        header with Bearer scheme

````

---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://exa.ai/docs/llms.txt