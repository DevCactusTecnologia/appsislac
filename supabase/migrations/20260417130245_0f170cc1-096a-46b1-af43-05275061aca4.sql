-- ========================================================================
-- SISLAC SEED — tenant default 0...01, volume leve, ~30 dias
-- PARTE 1: limpeza + cadastros base
-- ========================================================================

-- 0) LIMPEZA
DELETE FROM atendimento_pagamentos WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM atendimento_exames WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM atendimentos WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM orcamento_exames WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM orcamentos WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM financeiro_saidas WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM atendimento_audit WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM pacientes WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM especialistas WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM user_roles WHERE user_id IN (SELECT user_id FROM profiles WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND email LIKE '%@sislac.demo');
DELETE FROM profiles WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND email LIKE '%@sislac.demo';

-- 1) PROFILES (fantasma — sem login, apenas para listagens)
INSERT INTO profiles (user_id,nome,email,perfil,tenant_id,unidade_ids,unidade_ativa,status) VALUES ('05284a00-c6f6-49f1-b589-3dabd005d8fc','Juliana Recepção','recepcao@sislac.demo','recepcionista','00000000-0000-0000-0000-000000000001',ARRAY['und-001','und-003']::text[],'und-001','Ativo') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO profiles (user_id,nome,email,perfil,tenant_id,unidade_ids,unidade_ativa,status) VALUES ('96cd88c2-6cb1-4f35-807a-ef505f41c0d7','Ana Costa','ana.analista@sislac.demo','analista','00000000-0000-0000-0000-000000000001',ARRAY['und-001','und-002']::text[],'und-001','Ativo') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO profiles (user_id,nome,email,perfil,tenant_id,unidade_ids,unidade_ativa,status) VALUES ('7d56491f-74f6-4e4d-9230-73cefb702ca1','Carlos Mendes','carlos.analista@sislac.demo','analista','00000000-0000-0000-0000-000000000001',ARRAY['und-001']::text[],'und-001','Ativo') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO profiles (user_id,nome,email,perfil,tenant_id,unidade_ids,unidade_ativa,status) VALUES ('c4c87d91-ecf7-4b63-9dfb-148e0cbcba42','Patrícia Financeiro','financeiro@sislac.demo','financeiro','00000000-0000-0000-0000-000000000001',ARRAY['und-001','und-002']::text[],'und-001','Ativo') ON CONFLICT (user_id) DO NOTHING;

-- 2) ESPECIALISTAS (médicos solicitantes)
INSERT INTO especialistas (nome,crm,especialidade,telefone,email,tenant_id,status) VALUES
('Dr(a). Cláudia Souza','CRM-PE 13278','Urologista','(81) 98501-4657','medico1@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo'),
('Dr(a). Gabriel Moreira','CRM-PE 23434','Neurologista','(81) 98178-7912','medico2@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo'),
('Dr(a). Lucas Silva','CRM-PE 22280','Ginecologista','(81) 98476-9279','medico3@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo'),
('Dr(a). Renata Silva','CRM-PE 83563','Ginecologista','(81) 99466-9928','medico4@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo'),
('Dr(a). Sérgio Pereira','CRM-PE 68878','Geriatra','(81) 98569-1106','medico5@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo'),
('Dr(a). Daniela Andrade','CRM-PE 30926','Dermatologista','(81) 98696-5552','medico6@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo'),
('Dr(a). Daniel Almeida','CRM-PE 54118','Cardiologista','(81) 98189-7224','medico7@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo'),
('Dr(a). Bruno Ribeiro','CRM-PE 55082','Geriatra','(81) 98541-1711','medico8@clinica.demo','00000000-0000-0000-0000-000000000001','Ativo');

-- 3) PACIENTES (50)
INSERT INTO pacientes (nome,cpf,sexo,data_nascimento,celular,email,cep,estado,cidade,bairro,endereco,numero,status,tenant_id) VALUES
('Aline Souza Castro','959.310.341-45','F','1972-05-27','(81) 99708-6977','paciente1@email.demo','53113-284','PE','Olinda','Casa Forte','Rua Padre Carapuceiro','2613','Ativo','00000000-0000-0000-0000-000000000001'),
('Rodrigo Ribeiro Almeida','283.276.483-57','M','1966-02-20','(81) 98821-5386','paciente2@email.demo','51876-841','PE','Jaboatão dos Guararapes','Boa Viagem','Rua das Flores','1302','Ativo','00000000-0000-0000-0000-000000000001'),
('Bruno Castro Dias','767.242.388-62','M','1955-04-21','(81) 98741-4593','paciente3@email.demo','53509-919','PE','Jaboatão dos Guararapes','Várzea','Rua Frei Caneca','1645','Ativo','00000000-0000-0000-0000-000000000001'),
('Leonardo Melo Oliveira','269.166.978-57','M','1938-02-05','(81) 99812-9797','paciente4@email.demo','50094-696','PE','Jaboatão dos Guararapes','Boa Vista','Av. Boa Viagem','2802','Ativo','00000000-0000-0000-0000-000000000001'),
('Cristina Cardoso Costa','048.281.489-65','F','2010-03-15','(81) 99952-9689','paciente5@email.demo','53063-780','PE','Olinda','Espinheiro','Rua do Sol','2219','Ativo','00000000-0000-0000-0000-000000000001'),
('Diego Costa Melo','039.117.182-84','M','2012-05-08','(81) 99786-7932','paciente6@email.demo','54503-169','PE','Olinda','Tamarineira','Rua Real da Torre','2171','Ativo','00000000-0000-0000-0000-000000000001'),
('Nelson Rocha Cavalcanti','657.871.331-02','M','1959-12-10','(81) 98451-1117','paciente7@email.demo','54819-567','PE','Jaboatão dos Guararapes','Boa Viagem','Av. Conde da Boa Vista','2420','Ativo','00000000-0000-0000-0000-000000000001'),
('Paulo Cardoso Santos','834.738.299-94','M','2005-06-03','(81) 98193-2588','paciente8@email.demo','53874-826','PE','Caruaru','Pina','Rua do Príncipe','789','Ativo','00000000-0000-0000-0000-000000000001'),
('Adriana Carvalho Carvalho','106.513.338-30','F','2004-11-21','(81) 98511-2235','paciente9@email.demo','53456-187','PE','Caruaru','Espinheiro','Rua Real da Torre','1904','Ativo','00000000-0000-0000-0000-000000000001'),
('Mônica Moura Moura','013.267.736-90','F','2004-11-18','(81) 99897-8454','paciente10@email.demo','53104-002','PE','Recife','Espinheiro','Rua do Príncipe','1096','Ativo','00000000-0000-0000-0000-000000000001'),
('Sandra Teixeira Moreira','723.430.980-26','F','1948-11-23','(81) 99882-9701','paciente11@email.demo','50410-598','PE','Jaboatão dos Guararapes','Boa Viagem','Rua Padre Carapuceiro','2069','Ativo','00000000-0000-0000-0000-000000000001'),
('Pedro Barbosa Oliveira','361.939.909-33','M','1963-10-03','(81) 98647-5272','paciente12@email.demo','55385-597','PE','Recife','Aflitos','Rua Frei Caneca','2151','Ativo','00000000-0000-0000-0000-000000000001'),
('Fernando Teixeira Costa','475.107.991-39','M','1982-03-22','(81) 99911-6718','paciente13@email.demo','51746-518','PE','Recife','Boa Vista','Rua Real da Torre','552','Ativo','00000000-0000-0000-0000-000000000001'),
('Júlio Pereira Ribeiro','498.084.124-40','M','1979-09-23','(81) 99238-4450','paciente14@email.demo','54532-159','PE','Recife','Casa Forte','Av. Domingos Ferreira','920','Ativo','00000000-0000-0000-0000-000000000001'),
('Beatriz Almeida Lima','205.831.677-50','F','1987-08-14','(81) 99344-2156','paciente15@email.demo','51020-110','PE','Recife','Madalena','Av. Caxangá','1450','Ativo','00000000-0000-0000-0000-000000000001'),
('Henrique Santos Rocha','842.553.119-08','M','1995-01-30','(81) 98221-7733','paciente16@email.demo','52050-220','PE','Olinda','Aflitos','Rua das Flores','345','Ativo','00000000-0000-0000-0000-000000000001'),
('Letícia Barbosa Souza','310.667.428-19','F','1990-04-12','(81) 99655-4421','paciente17@email.demo','50670-330','PE','Recife','Pina','Av. Boa Viagem','1820','Ativo','00000000-0000-0000-0000-000000000001'),
('Ricardo Moreira Lima','671.224.553-71','M','1958-07-19','(81) 98774-9982','paciente18@email.demo','54330-440','PE','Paulista','Graças','Rua do Sol','672','Ativo','00000000-0000-0000-0000-000000000001'),
('Vanessa Pinto Andrade','523.118.846-22','F','1976-09-05','(81) 99117-3389','paciente19@email.demo','55880-550','PE','Caruaru','Tamarineira','Av. Conde da Boa Vista','2305','Ativo','00000000-0000-0000-0000-000000000001'),
('Marcelo Castro Dias','088.441.992-60','M','2009-02-17','(81) 99523-1148','paciente20@email.demo','51990-660','PE','Recife','Boa Vista','Rua do Príncipe','1267','Ativo','00000000-0000-0000-0000-000000000001'),
('Camila Reis Mendes','729.445.118-38','F','1968-06-25','(81) 98876-2294','paciente21@email.demo','50220-770','PE','Olinda','Espinheiro','Av. Caxangá','488','Ativo','00000000-0000-0000-0000-000000000001'),
('Antonio Ferreira Gomes','156.890.337-44','M','1944-11-08','(81) 99445-7716','paciente22@email.demo','53770-880','PE','Jaboatão dos Guararapes','Casa Forte','Rua Real da Torre','1905','Ativo','00000000-0000-0000-0000-000000000001'),
('Sofia Mendes Carvalho','411.336.882-25','F','2014-08-03','(81) 99882-3571','paciente23@email.demo','55440-990','PE','Paulista','Madalena','Av. Domingos Ferreira','1530','Ativo','00000000-0000-0000-0000-000000000001'),
('Eduardo Lima Costa','892.117.660-43','M','1983-12-11','(81) 98345-8821','paciente24@email.demo','50880-001','PE','Recife','Boa Viagem','Rua das Flores','2280','Ativo','00000000-0000-0000-0000-000000000001'),
('Priscila Castro Reis','347.991.225-87','F','1991-03-28','(81) 99221-4407','paciente25@email.demo','51330-112','PE','Olinda','Pina','Rua do Sol','1175','Ativo','00000000-0000-0000-0000-000000000001'),
('Rafael Andrade Rocha','663.802.117-19','M','2001-10-09','(81) 99553-6628','paciente26@email.demo','53550-223','PE','Recife','Aflitos','Av. Boa Viagem','645','Ativo','00000000-0000-0000-0000-000000000001'),
('Carla Pinto Nascimento','228.557.991-04','F','1985-05-16','(81) 98112-7794','paciente27@email.demo','55110-334','PE','Caruaru','Graças','Rua Padre Carapuceiro','1820','Ativo','00000000-0000-0000-0000-000000000001'),
('Roberto Carvalho Pinto','509.778.224-66','M','1952-09-22','(81) 99668-1145','paciente28@email.demo','50445-445','PE','Jaboatão dos Guararapes','Tamarineira','Av. Conde da Boa Vista','395','Ativo','00000000-0000-0000-0000-000000000001'),
('Isabela Souza Oliveira','075.224.667-92','F','2008-04-04','(81) 99334-8852','paciente29@email.demo','51660-556','PE','Olinda','Várzea','Rua Frei Caneca','1670','Ativo','00000000-0000-0000-0000-000000000001'),
('Marcos Almeida Pereira','394.118.005-33','M','1971-12-18','(81) 98556-2274','paciente30@email.demo','53880-667','PE','Paulista','Casa Forte','Av. Caxangá','2410','Ativo','00000000-0000-0000-0000-000000000001'),
('Daniela Rocha Lima','718.336.992-15','F','1994-07-07','(81) 99774-6638','paciente31@email.demo','55220-778','PE','Recife','Boa Vista','Rua do Príncipe','920','Ativo','00000000-0000-0000-0000-000000000001'),
('Felipe Santos Andrade','264.881.337-71','M','1987-02-26','(81) 98223-5547','paciente32@email.demo','50990-889','PE','Recife','Espinheiro','Rua Real da Torre','185','Ativo','00000000-0000-0000-0000-000000000001'),
('Larissa Dias Moreira','856.114.229-46','F','1980-10-13','(81) 99887-2241','paciente33@email.demo','51440-990','PE','Olinda','Madalena','Av. Domingos Ferreira','2120','Ativo','00000000-0000-0000-0000-000000000001'),
('José Cavalcanti Reis','139.557.882-08','M','1947-03-29','(81) 98445-7763','paciente34@email.demo','53110-001','PE','Jaboatão dos Guararapes','Aflitos','Rua das Flores','1485','Ativo','00000000-0000-0000-0000-000000000001'),
('Gabriela Melo Costa','672.119.448-25','F','1989-08-19','(81) 99221-5586','paciente35@email.demo','55330-112','PE','Caruaru','Pina','Rua do Sol','870','Ativo','00000000-0000-0000-0000-000000000001'),
('Diego Pereira Cardoso','445.882.117-94','M','2003-05-21','(81) 99117-3328','paciente36@email.demo','50550-223','PE','Recife','Boa Viagem','Av. Boa Viagem','1340','Ativo','00000000-0000-0000-0000-000000000001'),
('Tatiane Lima Ribeiro','283.667.119-50','F','1973-11-02','(81) 98774-2295','paciente37@email.demo','51770-334','PE','Olinda','Casa Forte','Rua Padre Carapuceiro','295','Ativo','00000000-0000-0000-0000-000000000001'),
('Vinícius Ferreira Silva','591.224.778-31','M','1996-06-15','(81) 99553-8814','paciente38@email.demo','55440-445','PE','Paulista','Tamarineira','Av. Conde da Boa Vista','1750','Ativo','00000000-0000-0000-0000-000000000001'),
('Eliana Castro Mendes','708.881.336-72','F','1962-04-08','(81) 98112-6657','paciente39@email.demo','50880-556','PE','Jaboatão dos Guararapes','Várzea','Rua Frei Caneca','620','Ativo','00000000-0000-0000-0000-000000000001'),
('Thiago Moura Almeida','316.557.882-93','M','1978-09-30','(81) 99668-4471','paciente40@email.demo','51220-667','PE','Recife','Graças','Av. Caxangá','2055','Ativo','00000000-0000-0000-0000-000000000001'),
('Bruna Carvalho Souza','829.114.665-04','F','2011-01-14','(81) 99887-1138','paciente41@email.demo','53330-778','PE','Olinda','Boa Vista','Rua do Príncipe','1480','Ativo','00000000-0000-0000-0000-000000000001'),
('Gustavo Nascimento Lima','174.336.992-26','M','1990-08-23','(81) 98223-7794','paciente42@email.demo','55550-889','PE','Caruaru','Espinheiro','Rua Real da Torre','745','Ativo','00000000-0000-0000-0000-000000000001'),
('Patrícia Reis Almeida','465.882.117-77','F','1985-12-05','(81) 99445-2261','paciente43@email.demo','50660-990','PE','Recife','Madalena','Av. Domingos Ferreira','1985','Ativo','00000000-0000-0000-0000-000000000001'),
('Júlio Andrade Cardoso','752.119.448-08','M','1957-07-17','(81) 98556-5583','paciente44@email.demo','51880-001','PE','Jaboatão dos Guararapes','Aflitos','Rua das Flores','350','Ativo','00000000-0000-0000-0000-000000000001'),
('Renata Pinto Moreira','391.667.225-39','F','1981-03-11','(81) 99774-1148','paciente45@email.demo','53990-112','PE','Paulista','Pina','Rua do Sol','2245','Ativo','00000000-0000-0000-0000-000000000001'),
('André Costa Teixeira','568.224.881-50','M','1968-10-26','(81) 99117-7726','paciente46@email.demo','55770-223','PE','Olinda','Boa Viagem','Av. Boa Viagem','1180','Ativo','00000000-0000-0000-0000-000000000001'),
('Aline Mendes Castro','047.336.998-61','F','1999-05-08','(81) 98774-3357','paciente47@email.demo','50440-334','PE','Recife','Casa Forte','Rua Padre Carapuceiro','680','Ativo','00000000-0000-0000-0000-000000000001'),
('Lucas Rocha Pereira','283.557.119-82','M','1942-11-19','(81) 99553-9985','paciente48@email.demo','51110-445','PE','Jaboatão dos Guararapes','Tamarineira','Av. Conde da Boa Vista','2580','Ativo','00000000-0000-0000-0000-000000000001'),
('Cláudia Santos Dias','619.882.224-93','F','1977-08-02','(81) 98112-2236','paciente49@email.demo','55880-556','PE','Caruaru','Várzea','Rua Frei Caneca','1395','Ativo','00000000-0000-0000-0000-000000000001'),
('Bruno Lima Cavalcanti','834.116.557-04','M','1993-02-14','(81) 99668-5582','paciente50@email.demo','53220-667','PE','Recife','Graças','Av. Caxangá','870','Ativo','00000000-0000-0000-0000-000000000001');