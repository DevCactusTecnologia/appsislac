-- Seed IBGE: 27 estados brasileiros (idempotente)
INSERT INTO public.states (id, name, uf) VALUES
(11, 'RONDONIA', 'RO'),(12, 'ACRE', 'AC'),(13, 'AMAZONAS', 'AM'),(14, 'RORAIMA', 'RR'),
(15, 'PARA', 'PA'),(16, 'AMAPA', 'AP'),(17, 'TOCANTINS', 'TO'),(21, 'MARANHAO', 'MA'),
(22, 'PIAUI', 'PI'),(23, 'CEARA', 'CE'),(24, 'RIO GRANDE DO NORTE', 'RN'),(25, 'PARAIBA', 'PB'),
(26, 'PERNAMBUCO', 'PE'),(27, 'ALAGOAS', 'AL'),(28, 'SERGIPE', 'SE'),(29, 'BAHIA', 'BA'),
(31, 'MINAS GERAIS', 'MG'),(32, 'ESPIRITO SANTO', 'ES'),(33, 'RIO DE JANEIRO', 'RJ'),(35, 'SAO PAULO', 'SP'),
(41, 'PARANA', 'PR'),(42, 'SANTA CATARINA', 'SC'),(43, 'RIO GRANDE DO SUL', 'RS'),(50, 'MATO GROSSO DO SUL', 'MS'),
(51, 'MATO GROSSO', 'MT'),(52, 'GOIAS', 'GO'),(53, 'DISTRITO FEDERAL', 'DF')
ON CONFLICT (id) DO NOTHING;