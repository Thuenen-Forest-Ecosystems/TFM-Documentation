# Getting Started

You can access data in **three** ways. The easiest is to use the API, which is the most common way to access data but comes with limitations. The second is to use the self-hosted version of the database. You can choose between a **full server setup** or a **data-only setup**.

::: tip Technical issues
There can be downtime of the API or temporary issues with the self-hosted version due to updates or maintenance.

If you have problems using the **self-hosted** version or the **API**, please create an issue on [GitHub](https://github.com/Thuenen-Forest-Ecosystems/TFM-Server/issues).
:::

## Self Hosted

### Data only

You can download the database as a `.sql` file. This file contains all the data and structure of the database. You can import this file into your own PostgreSQL database. This way you can access the data **without any limitations**.

1. Structure: [Lookup Tables](https://github.com/Thuenen-Forest-Ecosystems/TFM-Server/blob/main/supabase/migrations/20241202134805_lookup.sql)
2. Structure: [Inventory Archive Tables](https://github.com/Thuenen-Forest-Ecosystems/TFM-Server/blob/main/supabase/migrations/20250115140817_inventory_archive.sql)
3. Data: [Lookup and Inventory Data](https://git-dmz.thuenen.de/tfm-seeds/public)

::: tip Setup
Dependent on your use case and database setup you might need [additional configuration](https://github.com/Thuenen-Forest-Ecosystems/TFM-Server/tree/main/supabase/migrations).
:::

### Full Server

Using the self-hosted version need some **technical knowledge**. The self-hosted version is a PostgreSQL database that contains all the structure, data and API. You download the database and host it on your own server or locally. This way you can access the data **without any limitations**.

The docker based source code of the self-hosted version of the database can be found on [GitHub](https://github.com/Thuenen-Forest-Ecosystems/TFM-Server).

## API Requests

The API is the easiest way to access the data. You can access the  RESTful API with any programming language that supports HTTP requests. The Database and API is hosted by the Thünen Institut.

::: warning Limitations
API Requests are limited by time and the amount of data that can be retrieved in a single request. The API should only be used for filtered queries and not for bulk data extraction.
:::

## Survey instructions
[Survey instruction  CI2027](https://www.thuenen.de/media/institute/wo/Waldmonitoring/THG/Dokumente/ci2027_anweis_20250829.pdf)
