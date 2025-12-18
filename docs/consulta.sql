-PRIMEIRO LANÇAMENTOS DE CRÉDITO (CONTABILIZANDO NA CONTA CRÉDITO)
select * from (
select
	'AGROSS' as empresa,
	case
		when lanc.codigo is null then ''
		else 'DÉBITO' --(ALTERAR CRÉDITO X DÉBITO)
	end as tipo,
	lanc.codigo as codigo_lanc,
	-1*rateio.valrat as vl_rateado, --(ALTERAR SINAL - CRÉDITO X DÉBITO)
	case
		when g3.clacon in ('311','312') then -1*rateio.valrat
	end	as rol,
	lanc.datlan as data,
	case 
		when g3.clacon in ('311','312') then '1) ( = ) RECEITA OPERACIONAL LÍQUIDA'
		when g3.clacon in ('321') then '2) ( - ) CPV/CMV/CSP'
		when g4.clacon in ('32201','32202') then '3) ( - ) DESPESAS OPERACIONAIS'
		when g3.clacon in ('313','314') then '4) ( + ) OUTRAS RECEITAS OPERACIONAIS'
		when g4.clacon in ('32205') then '5) ( - ) OUTRAS DESPESAS OPERACIONAIS'
		when g4.clacon in ('32301') then '6) ( + ) RECEITAS FINANCEIRAS'
		when g4.clacon in ('32303') then '7) ( - ) DESPESAS FINANCEIRAS'
		when g3.clacon in ('324') or g5.clacon in ('3229901') then '8) ( +/- ) RESULTADO NÃO OPERACIONAL'
	end as linha_dre,
	concat(g1.clacon,' - ',g1.descri) g1,
	concat(g2.clacon,' - ',g2.descri) g2,
	concat(g3.clacon,' - ',g3.descri) g3,
	concat(g4.clacon,' - ',g4.descri) g4,
	concat(g5.clacon,' - ',g5.descri) g5,
	case
		when g6.clacon is null then ''
		else concat(g6.clacon,' - ',g6.descri)
	end as g6,
	hierarquia.clacon,
	hierarquia.descri as conta_contabil,
	case hierarquia.sinana 
		when 'S' then 'SINTÉTICA'
		when 'A' then 'ANALÍTICA'
	end as tipo_conta,
	centro.codigo as cod_centro,
	centro.descri as centro_resultado,
	case centro.codigo
		when 231 then 'ADM.FINANCEIRO' --CONTABIL/FISCAL
		when 82 then 'ADM.FINANCEIRO' --FINANCEIRO
		when 43 then 'ADM.FINANCEIRO' --FINANCEIRO/RH
		when 22 then 'ADM.FINANCEIRO' --ADMINISTRATIVO
		when 104 then 'COMERCIAL' --AGRISHOW
		when 249 then 'COMERCIAL' --FEIRA - SHOW SAFRA
		when 30 then 'COMERCIAL' --COMERCIAL
		when 206 then 'COMERCIAL' --AGROBRASILIA
		when 113 then 'COMERCIAL' --AGROLEITE
		when 124 then 'COMERCIAL' --EXPODIRETO
		when 204 then 'COMERCIAL' --EXPOINTER
		when 271 then 'COMERCIAL' --FEIRAS - FENASUCRO E AGROCANA
		when 273 then 'COMERCIAL' --FEIRA MILKSHOW
		when 54 then 'COMERCIAL' --MARKETING
		when 205 then 'COMERCIAL' --SHOW RURAL
		when 137 then 'COMERCIAL' --VENDAS EXTERNAS
		when 136 then 'COMERCIAL' --VENDAS INTERNAS
		when 261 then 'COMERCIAL' --FEIRAS - FENACAO
		when 267 then 'COMERCIAL' --FEIRAS - COOPAVEL
		when 270 then 'COMERCIAL' --FEIRAS - EXPOQUINZE
		when 165 then 'DIREÇÃO' --CONTROLADORIA
		when 5 then 'DIREÇÃO' --DIREÇÃO
		when 211 then 'DIREÇÃO' --PRÉDIOS E UTILIDADES
		when 81 then 'DIREÇÃO' --DIREÇÃO
		when 274 then 'GENTE E GESTÃO' --GENTE E GESTÃO
		when 232 then 'GENTE E GESTÃO' --TI
		when 233 then 'GENTE E GESTÃO' --SEGURANÇA DO TRABALHO
		when 84 then 'GENTE E GESTÃO' --RH
		when 83 then 'GENTE E GESTÃO' --LIMPEZA
		when 23 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 95 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 209 then 'PRODUCAO' --GESTÃO DE PRODUÇÃO
		when 9 then 'PRODUCAO' --CORTE LASER
		when 108 then 'PRODUCAO' --SUPERVISÃO PRODUÇÃO
		when 65 then 'PRODUCAO' --EXPEDIÇÃO
		when 72 then 'PRODUCAO' --PCP
		when 87 then 'PRODUCAO' --CORTE
		when 160 then 'PRODUCAO' --CORTE LASER
		when 32 then 'PRODUCAO' --CORTE SERRA
		when 207 then 'PRODUCAO' --CORTE SERRA
		when 8 then 'PRODUCAO' --DOBRA
		when 88 then 'PRODUCAO' --DOBRA
		when 234 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 210 then 'PRODUCAO' --MÉTODOS E PROCESSOS
		when 237 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 17 then 'PRODUCAO' --MANUTENCAO
		when 144 then 'PRODUCAO' --MANUTENÇÃO
		when 33 then 'PRODUCAO' --MONTAGEM
		when 90 then 'PRODUCAO' --MONTAGEM
		when 14 then 'PRODUCAO' --PCP
		when 10 then 'PRODUCAO' --PINTURA / JATO / LIMPEZA
		when 91 then 'PRODUCAO' --PINTURA
		when 33 then 'PRODUCAO' --PRODUÇÃO DIRETOS
		when 34 then 'PRODUCAO' --PRODUÇÃO INDIRETOS
		when 7 then 'PRODUCAO' --SOLDA
		when 92 then 'PRODUCAO' --SOLDA
		when 21 then 'PRODUCAO' --USINAGEM
		when 93 then 'PRODUCAO' --USINAGEM
		when 208 then 'SUPPLY CHAIN' --LOGISTICA
		when 37 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 85 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 80 then 'SUPPLY CHAIN' --COMPRAS
		when 19 then 'SUPPLY CHAIN' --ESTOQUE
		when 44 then 'SUPPLY CHAIN' --ESTOQUE
		when 223 then 'SUPPLY CHAIN' --MERCADO ENTRADA
		when 224 then 'SUPPLY CHAIN' --MERCADO SAIDA
		when 86 then 'SUPPLY CHAIN' --LOGISTICA/FROTA
		when 25 then 'SUPPLY CHAIN' --PREDIOS E UTILIDADES
		when 15 then 'SUPPLY CHAIN' --QUALIDADE
		when 97 then 'SUPPLY CHAIN' --QUALIDADE
		when 226 then 'PÓS VENDA' --VENDAS DE PEÇAS
		else 'NÃO CLASSIFICADO'
	end as departamento,
	departamento.descri as departamento_sistema,
	lanc.hislan as historico_contabil,
		case lanc.orilan
		when 'ADI' then 'Adiantamento'
		when 'ANT' then 'Antecipação'
		when 'APA' then 'Apropriação de Antecipação'
		when 'APC' then 'Apropriação de Parcelas de Contrato'
		when 'BAD' then 'Baixa de Duplicatas'
		when 'BAN' then 'Banco'
		when 'BPC' then 'Baixa de Parcela de Contrato'
		when 'CAG' then 'Custo Agregado'
		when 'CTA' then 'Contratos'
		when 'DUP' then 'Duplicata'
		when 'ENT' then 'Entrada de Mercadoria'
		when 'FAT' then 'Faturamento'
		when 'IMP' then 'Importação (de lançamentos contábeis)'
		when 'MAN' then 'Manual'
		when 'MAP' then 'Mapa de Custo'
		when 'PAB' then 'Patrimonial'
		when 'PAD' then 'Depreciação'
		when 'TPC' then 'Apropriações de Contratos'
		when 'VDV' then 'Transf. Participante - Despesas de Viagens'
	end as origem_lanc
from 
	public.erp_placon hierarquia
	left join con_lancon lanc on hierarquia.codint = lanc.condeb --Lançamento Contábil (ALTERAR condeb x concre)
	left join public.erp_placon conta on lanc.condeb = conta.codint --Conta Contábil (ALTERAR condeb x concre)
	left join con_ratlan rateio on lanc.codigo = rateio.codigo --Rateio do Lançamento Contábil por Centro de Custos
	left join public.erp_centro centro on rateio.codcen = centro.codigo --Centro Resultado
	left join public.erp_caddep departamento on centro.coddep = departamento.codigo
	left join public.erp_placon g1 on g1.clacon = substring(hierarquia.clacon,1,1)
	left join public.erp_placon g2 on g2.clacon = substring(hierarquia.clacon,1,2)
	left join public.erp_placon g3 on g3.clacon = substring(hierarquia.clacon,1,3)
	left join public.erp_placon g4 on g4.clacon = substring(hierarquia.clacon,1,5)
	left join public.erp_placon g5 on g5.clacon = substring(hierarquia.clacon,1,7)
	left join public.erp_placon g6 on g6.clacon = substring(hierarquia.clacon,1,9)
where
	lanc.coduni in (136,137)
	and g1.clacon = '3'
	and not (hierarquia.sinana = 'A' and lanc.codigo is null) -- Pra não trazer as contas analíticas que estão sem nenhum lançamento
	and lanc.orilan <> 'Z' --Ignorar lançamentos de 'Transferência de Valores Para Conta de Resultado'
union all
--SEGUNDO LANÇAMENTOS DE DÉBITO (CONTABILIZANDO NA CONTA DÉBITO)
select
	'AGROSS' as empresa,
	case
		when lanc.codigo is null then ''
		else 'CRÉDITO' --(ALTERAR CRÉDITO X DÉBITO)
	end as tipo,
	lanc.codigo as codigo_lanc,
	rateio.valrat as vl_rateado, --(ALTERAR SINAL - CRÉDITO X DÉBITO)
	case
		when g3.clacon in ('311','312') then rateio.valrat
	end	as rol,
	lanc.datlan as data,
	case 
		when g3.clacon in ('311','312') then '1) ( = ) RECEITA OPERACIONAL LÍQUIDA'
		when g3.clacon in ('321') then '2) ( - ) CPV/CMV/CSP'
		when g4.clacon in ('32201','32202') then '3) ( - ) DESPESAS OPERACIONAIS'
		when g3.clacon in ('313','314') then '4) ( + ) OUTRAS RECEITAS OPERACIONAIS'
		when g4.clacon in ('32205') then '5) ( - ) OUTRAS DESPESAS OPERACIONAIS'
		when g4.clacon in ('32301') then '6) ( + ) RECEITAS FINANCEIRAS'
		when g4.clacon in ('32303') then '7) ( - ) DESPESAS FINANCEIRAS'
		when g3.clacon in ('324') or g5.clacon in ('3229901') then '8) ( +/- ) RESULTADO NÃO OPERACIONAL'
	end as linha_dre,
	concat(g1.clacon,' - ',g1.descri) g1,
	concat(g2.clacon,' - ',g2.descri) g2,
	concat(g3.clacon,' - ',g3.descri) g3,
	concat(g4.clacon,' - ',g4.descri) g4,
	concat(g5.clacon,' - ',g5.descri) g5,
	case
		when g6.clacon is null then ''
		else concat(g6.clacon,' - ',g6.descri)
	end as g6,
	hierarquia.clacon,
	hierarquia.descri as conta_contabil,
	case hierarquia.sinana 
		when 'S' then 'SINTÉTICA'
		when 'A' then 'ANALÍTICA'
	end as tipo_conta,
	centro.codigo as cod_centro,
	centro.descri as centro_resultado,
	case centro.codigo
		when 231 then 'ADM.FINANCEIRO' --CONTABIL/FISCAL
		when 82 then 'ADM.FINANCEIRO' --FINANCEIRO
		when 43 then 'ADM.FINANCEIRO' --FINANCEIRO/RH
		when 22 then 'ADM.FINANCEIRO' --ADMINISTRATIVO
		when 104 then 'COMERCIAL' --AGRISHOW
		when 249 then 'COMERCIAL' --FEIRA - SHOW SAFRA
		when 30 then 'COMERCIAL' --COMERCIAL
		when 206 then 'COMERCIAL' --AGROBRASILIA
		when 113 then 'COMERCIAL' --AGROLEITE
		when 124 then 'COMERCIAL' --EXPODIRETO
		when 204 then 'COMERCIAL' --EXPOINTER
		when 271 then 'COMERCIAL' --FEIRAS - FENASUCRO E AGROCANA
		when 273 then 'COMERCIAL' --FEIRA MILKSHOW
		when 54 then 'COMERCIAL' --MARKETING
		when 205 then 'COMERCIAL' --SHOW RURAL
		when 137 then 'COMERCIAL' --VENDAS EXTERNAS
		when 136 then 'COMERCIAL' --VENDAS INTERNAS
		when 261 then 'COMERCIAL' --FEIRAS - FENACAO
		when 267 then 'COMERCIAL' --FEIRAS - COOPAVEL
		when 270 then 'COMERCIAL' --FEIRAS - EXPOQUINZE
		when 165 then 'DIREÇÃO' --CONTROLADORIA
		when 5 then 'DIREÇÃO' --DIREÇÃO
		when 211 then 'DIREÇÃO' --PRÉDIOS E UTILIDADES
		when 81 then 'DIREÇÃO' --DIREÇÃO
		when 274 then 'GENTE E GESTÃO' --GENTE E GESTÃO
		when 232 then 'GENTE E GESTÃO' --TI
		when 233 then 'GENTE E GESTÃO' --SEGURANÇA DO TRABALHO
		when 84 then 'GENTE E GESTÃO' --RH
		when 83 then 'GENTE E GESTÃO' --LIMPEZA
		when 23 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 95 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 209 then 'PRODUCAO' --GESTÃO DE PRODUÇÃO
		when 9 then 'PRODUCAO' --CORTE LASER
		when 108 then 'PRODUCAO' --SUPERVISÃO PRODUÇÃO
		when 65 then 'PRODUCAO' --EXPEDIÇÃO
		when 72 then 'PRODUCAO' --PCP
		when 87 then 'PRODUCAO' --CORTE
		when 160 then 'PRODUCAO' --CORTE LASER
		when 32 then 'PRODUCAO' --CORTE SERRA
		when 207 then 'PRODUCAO' --CORTE SERRA
		when 8 then 'PRODUCAO' --DOBRA
		when 88 then 'PRODUCAO' --DOBRA
		when 234 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 210 then 'PRODUCAO' --MÉTODOS E PROCESSOS
		when 237 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 17 then 'PRODUCAO' --MANUTENCAO
		when 144 then 'PRODUCAO' --MANUTENÇÃO
		when 33 then 'PRODUCAO' --MONTAGEM
		when 90 then 'PRODUCAO' --MONTAGEM
		when 14 then 'PRODUCAO' --PCP
		when 10 then 'PRODUCAO' --PINTURA / JATO / LIMPEZA
		when 91 then 'PRODUCAO' --PINTURA
		when 33 then 'PRODUCAO' --PRODUÇÃO DIRETOS
		when 34 then 'PRODUCAO' --PRODUÇÃO INDIRETOS
		when 7 then 'PRODUCAO' --SOLDA
		when 92 then 'PRODUCAO' --SOLDA
		when 21 then 'PRODUCAO' --USINAGEM
		when 93 then 'PRODUCAO' --USINAGEM
		when 208 then 'SUPPLY CHAIN' --LOGISTICA
		when 37 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 85 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 80 then 'SUPPLY CHAIN' --COMPRAS
		when 19 then 'SUPPLY CHAIN' --ESTOQUE
		when 44 then 'SUPPLY CHAIN' --ESTOQUE
		when 223 then 'SUPPLY CHAIN' --MERCADO ENTRADA
		when 224 then 'SUPPLY CHAIN' --MERCADO SAIDA
		when 86 then 'SUPPLY CHAIN' --LOGISTICA/FROTA
		when 25 then 'SUPPLY CHAIN' --PREDIOS E UTILIDADES
		when 15 then 'SUPPLY CHAIN' --QUALIDADE
		when 97 then 'SUPPLY CHAIN' --QUALIDADE
		when 226 then 'PÓS VENDA' --VENDAS DE PEÇAS
		else 'NÃO CLASSIFICADO'
	end as departamento,
	departamento.descri as departamento_sistema,
	lanc.hislan as historico_contabil,
		case lanc.orilan
		when 'ADI' then 'Adiantamento'
		when 'ANT' then 'Antecipação'
		when 'APA' then 'Apropriação de Antecipação'
		when 'APC' then 'Apropriação de Parcelas de Contrato'
		when 'BAD' then 'Baixa de Duplicatas'
		when 'BAN' then 'Banco'
		when 'BPC' then 'Baixa de Parcela de Contrato'
		when 'CAG' then 'Custo Agregado'
		when 'CTA' then 'Contratos'
		when 'DUP' then 'Duplicata'
		when 'ENT' then 'Entrada de Mercadoria'
		when 'FAT' then 'Faturamento'
		when 'IMP' then 'Importação (de lançamentos contábeis)'
		when 'MAN' then 'Manual'
		when 'MAP' then 'Mapa de Custo'
		when 'PAB' then 'Patrimonial'
		when 'PAD' then 'Depreciação'
		when 'TPC' then 'Apropriações de Contratos'
		when 'VDV' then 'Transf. Participante - Despesas de Viagens'
	end as origem_lanc
from 
	public.erp_placon hierarquia
	left join con_lancon lanc on hierarquia.codint = lanc.concre --Lançamento Contábil (ALTERAR condeb x concre)
	left join public.erp_placon conta on lanc.concre = conta.codint --Conta Contábil (ALTERAR condeb x concre)
	left join con_ratlan rateio on lanc.codigo = rateio.codigo --Rateio do Lançamento Contábil por Centro de Custos
	left join public.erp_centro centro on rateio.codcen = centro.codigo --Centro Resultado
	left join public.erp_caddep departamento on centro.coddep = departamento.codigo
	left join public.erp_placon g1 on g1.clacon = substring(hierarquia.clacon,1,1)
	left join public.erp_placon g2 on g2.clacon = substring(hierarquia.clacon,1,2)
	left join public.erp_placon g3 on g3.clacon = substring(hierarquia.clacon,1,3)
	left join public.erp_placon g4 on g4.clacon = substring(hierarquia.clacon,1,5)
	left join public.erp_placon g5 on g5.clacon = substring(hierarquia.clacon,1,7)
	left join public.erp_placon g6 on g6.clacon = substring(hierarquia.clacon,1,9)
where
	lanc.coduni in (136,137)
	and g1.clacon = '3'
	and not (hierarquia.sinana = 'A' and lanc.codigo is null) -- Pra não trazer as contas analíticas que estão sem nenhum lançamento
	and lanc.orilan <> 'Z' --Ignorar lançamentos de 'Transferência de Valores Para Conta de Resultado'
union all
--3° e 4°) PROVISÕES TRIBUTÁRIAS - IRPJ E CSLL SOBRE O LUCRO
select
	'AGROSS' as empresa,
	case
		when lanc.codigo is null then ''
		else 'DÉBITO' --(ALTERAR CRÉDITO X DÉBITO)
	end as tipo,
	lanc.codigo as codigo_lanc,
	-1*rateio.valrat as vl_rateado, --(ALTERAR SINAL - CRÉDITO X DÉBITO)
	null as rol,
	lanc.datlan as data,
	'9) ( - ) PROVISÃO PARA IR E CSLL' as linha_dre,
	concat(g1.clacon,' - ',g1.descri) g1,
	concat(g2.clacon,' - ',g2.descri) g2,
	concat(g3.clacon,' - ',g3.descri) g3,
	concat(g4.clacon,' - ',g4.descri) g4,
	concat(g5.clacon,' - ',g5.descri) g5,
	case
		when g6.clacon is null then ''
		else concat(g6.clacon,' - ',g6.descri)
	end as g6,
	hierarquia.clacon,
	hierarquia.descri as conta_contabil,
	case hierarquia.sinana 
		when 'S' then 'SINTÉTICA'
		when 'A' then 'ANALÍTICA'
	end as tipo_conta,
	centro.codigo as cod_centro,
	centro.descri as centro_resultado,
	case centro.codigo
		when 231 then 'ADM.FINANCEIRO' --CONTABIL/FISCAL
		when 82 then 'ADM.FINANCEIRO' --FINANCEIRO
		when 43 then 'ADM.FINANCEIRO' --FINANCEIRO/RH
		when 22 then 'ADM.FINANCEIRO' --ADMINISTRATIVO
		when 104 then 'COMERCIAL' --AGRISHOW
		when 249 then 'COMERCIAL' --FEIRA - SHOW SAFRA
		when 30 then 'COMERCIAL' --COMERCIAL
		when 206 then 'COMERCIAL' --AGROBRASILIA
		when 113 then 'COMERCIAL' --AGROLEITE
		when 124 then 'COMERCIAL' --EXPODIRETO
		when 204 then 'COMERCIAL' --EXPOINTER
		when 271 then 'COMERCIAL' --FEIRAS - FENASUCRO E AGROCANA
		when 273 then 'COMERCIAL' --FEIRA MILKSHOW
		when 54 then 'COMERCIAL' --MARKETING
		when 205 then 'COMERCIAL' --SHOW RURAL
		when 137 then 'COMERCIAL' --VENDAS EXTERNAS
		when 136 then 'COMERCIAL' --VENDAS INTERNAS
		when 165 then 'DIREÇÃO' --CONTROLADORIA
		when 5 then 'DIREÇÃO' --DIREÇÃO
		when 211 then 'DIREÇÃO' --PRÉDIOS E UTILIDADES
		when 81 then 'DIREÇÃO' --DIREÇÃO
		when 274 then 'GENTE E GESTÃO' --GENTE E GESTÃO
		when 232 then 'GENTE E GESTÃO' --TI
		when 233 then 'GENTE E GESTÃO' --SEGURANÇA DO TRABALHO
		when 84 then 'GENTE E GESTÃO' --RH
		when 83 then 'GENTE E GESTÃO' --LIMPEZA
		when 23 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 95 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 209 then 'PRODUCAO' --GESTÃO DE PRODUÇÃO
		when 9 then 'PRODUCAO' --CORTE LASER
		when 108 then 'PRODUCAO' --SUPERVISÃO PRODUÇÃO
		when 65 then 'PRODUCAO' --EXPEDIÇÃO
		when 72 then 'PRODUCAO' --PCP
		when 87 then 'PRODUCAO' --CORTE
		when 160 then 'PRODUCAO' --CORTE LASER
		when 32 then 'PRODUCAO' --CORTE SERRA
		when 207 then 'PRODUCAO' --CORTE SERRA
		when 8 then 'PRODUCAO' --DOBRA
		when 88 then 'PRODUCAO' --DOBRA
		when 234 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 210 then 'PRODUCAO' --MÉTODOS E PROCESSOS
		when 237 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 17 then 'PRODUCAO' --MANUTENCAO
		when 144 then 'PRODUCAO' --MANUTENÇÃO
		when 33 then 'PRODUCAO' --MONTAGEM
		when 90 then 'PRODUCAO' --MONTAGEM
		when 14 then 'PRODUCAO' --PCP
		when 10 then 'PRODUCAO' --PINTURA / JATO / LIMPEZA
		when 91 then 'PRODUCAO' --PINTURA
		when 33 then 'PRODUCAO' --PRODUÇÃO DIRETOS
		when 34 then 'PRODUCAO' --PRODUÇÃO INDIRETOS
		when 7 then 'PRODUCAO' --SOLDA
		when 92 then 'PRODUCAO' --SOLDA
		when 21 then 'PRODUCAO' --USINAGEM
		when 93 then 'PRODUCAO' --USINAGEM
		when 208 then 'SUPPLY CHAIN' --LOGISTICA
		when 37 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 85 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 80 then 'SUPPLY CHAIN' --COMPRAS
		when 19 then 'SUPPLY CHAIN' --ESTOQUE
		when 44 then 'SUPPLY CHAIN' --ESTOQUE
		when 223 then 'SUPPLY CHAIN' --MERCADO ENTRADA
		when 224 then 'SUPPLY CHAIN' --MERCADO SAIDA
		when 86 then 'SUPPLY CHAIN' --LOGISTICA/FROTA
		when 25 then 'SUPPLY CHAIN' --PREDIOS E UTILIDADES
		when 15 then 'SUPPLY CHAIN' --QUALIDADE
		when 97 then 'SUPPLY CHAIN' --QUALIDADE
		when 226 then 'PÓS VENDA' --VENDAS DE PEÇAS
		else 'NÃO CLASSIFICADO'
	end as departamento,
	departamento.descri as departamento_sistema,
	lanc.hislan as historico_contabil,
		case lanc.orilan
		when 'ADI' then 'Adiantamento'
		when 'ANT' then 'Antecipação'
		when 'APA' then 'Apropriação de Antecipação'
		when 'APC' then 'Apropriação de Parcelas de Contrato'
		when 'BAD' then 'Baixa de Duplicatas'
		when 'BAN' then 'Banco'
		when 'BPC' then 'Baixa de Parcela de Contrato'
		when 'CAG' then 'Custo Agregado'
		when 'CTA' then 'Contratos'
		when 'DUP' then 'Duplicata'
		when 'ENT' then 'Entrada de Mercadoria'
		when 'FAT' then 'Faturamento'
		when 'IMP' then 'Importação (de lançamentos contábeis)'
		when 'MAN' then 'Manual'
		when 'MAP' then 'Mapa de Custo'
		when 'PAB' then 'Patrimonial'
		when 'PAD' then 'Depreciação'
		when 'TPC' then 'Apropriações de Contratos'
		when 'VDV' then 'Transf. Participante - Despesas de Viagens'
	end as origem_lanc
from 
	public.erp_placon hierarquia
	left join con_lancon lanc on hierarquia.codint = lanc.condeb --Lançamento Contábil (ALTERAR condeb x concre)
	left join public.erp_placon conta on lanc.condeb = conta.codint --Conta Contábil (ALTERAR condeb x concre)
	left join con_ratlan rateio on lanc.codigo = rateio.codigo --Rateio do Lançamento Contábil por Centro de Custos
	left join public.erp_centro centro on rateio.codcen = centro.codigo --Centro Resultado
	left join public.erp_caddep departamento on centro.coddep = departamento.codigo
	left join public.erp_placon g1 on g1.clacon = substring(hierarquia.clacon,1,1)
	left join public.erp_placon g2 on g2.clacon = substring(hierarquia.clacon,1,2)
	left join public.erp_placon g3 on g3.clacon = substring(hierarquia.clacon,1,3)
	left join public.erp_placon g4 on g4.clacon = substring(hierarquia.clacon,1,5)
	left join public.erp_placon g5 on g5.clacon = substring(hierarquia.clacon,1,7)
	left join public.erp_placon g6 on g6.clacon = substring(hierarquia.clacon,1,9)
where
	lanc.coduni in (136,137)
	and g5.clacon = '4110101'
	and not (hierarquia.sinana = 'A' and lanc.codigo is null) -- Pra não trazer as contas analíticas que estão sem nenhum lançamento
	and lanc.orilan <> 'Z' --Ignorar lançamentos de 'Transferência de Valores Para Conta de Resultado'
union all
--SEGUNDO LANÇAMENTOS DE DÉBITO (CONTABILIZANDO NA CONTA DÉBITO)
select
	'AGROSS' as empresa,
	case
		when lanc.codigo is null then ''
		else 'CRÉDITO' --(ALTERAR CRÉDITO X DÉBITO)
	end as tipo,
	lanc.codigo as codigo_lanc,
	rateio.valrat as vl_rateado, --(ALTERAR SINAL - CRÉDITO X DÉBITO)
	null as rol,
	lanc.datlan as data,
	'9) ( - ) PROVISÃO PARA IR E CSLL' as linha_dre,
	concat(g1.clacon,' - ',g1.descri) g1,
	concat(g2.clacon,' - ',g2.descri) g2,
	concat(g3.clacon,' - ',g3.descri) g3,
	concat(g4.clacon,' - ',g4.descri) g4,
	concat(g5.clacon,' - ',g5.descri) g5,
	case
		when g6.clacon is null then ''
		else concat(g6.clacon,' - ',g6.descri)
	end as g6,
	hierarquia.clacon,
	hierarquia.descri as conta_contabil,
	case hierarquia.sinana 
		when 'S' then 'SINTÉTICA'
		when 'A' then 'ANALÍTICA'
	end as tipo_conta,
	centro.codigo as cod_centro,
	centro.descri as centro_resultado,
	case centro.codigo
		when 231 then 'ADM.FINANCEIRO' --CONTABIL/FISCAL
		when 82 then 'ADM.FINANCEIRO' --FINANCEIRO
		when 43 then 'ADM.FINANCEIRO' --FINANCEIRO/RH
		when 22 then 'ADM.FINANCEIRO' --ADMINISTRATIVO
		when 104 then 'COMERCIAL' --AGRISHOW
		when 249 then 'COMERCIAL' --FEIRA - SHOW SAFRA
		when 30 then 'COMERCIAL' --COMERCIAL
		when 206 then 'COMERCIAL' --AGROBRASILIA
		when 113 then 'COMERCIAL' --AGROLEITE
		when 124 then 'COMERCIAL' --EXPODIRETO
		when 204 then 'COMERCIAL' --EXPOINTER
		when 271 then 'COMERCIAL' --FEIRAS - FENASUCRO E AGROCANA
		when 273 then 'COMERCIAL' --FEIRA MILKSHOW
		when 54 then 'COMERCIAL' --MARKETING
		when 205 then 'COMERCIAL' --SHOW RURAL
		when 137 then 'COMERCIAL' --VENDAS EXTERNAS
		when 136 then 'COMERCIAL' --VENDAS INTERNAS
		when 165 then 'DIREÇÃO' --CONTROLADORIA
		when 5 then 'DIREÇÃO' --DIREÇÃO
		when 211 then 'DIREÇÃO' --PRÉDIOS E UTILIDADES
		when 81 then 'DIREÇÃO' --DIREÇÃO
		when 274 then 'GENTE E GESTÃO' --GENTE E GESTÃO
		when 232 then 'GENTE E GESTÃO' --TI
		when 233 then 'GENTE E GESTÃO' --SEGURANÇA DO TRABALHO
		when 84 then 'GENTE E GESTÃO' --RH
		when 83 then 'GENTE E GESTÃO' --LIMPEZA
		when 23 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 95 then 'ENGENHARIA' --ENGENHARIA DE PRODUTO
		when 209 then 'PRODUCAO' --GESTÃO DE PRODUÇÃO
		when 9 then 'PRODUCAO' --CORTE LASER
		when 108 then 'PRODUCAO' --SUPERVISÃO PRODUÇÃO
		when 65 then 'PRODUCAO' --EXPEDIÇÃO
		when 72 then 'PRODUCAO' --PCP
		when 87 then 'PRODUCAO' --CORTE
		when 160 then 'PRODUCAO' --CORTE LASER
		when 32 then 'PRODUCAO' --CORTE SERRA
		when 207 then 'PRODUCAO' --CORTE SERRA
		when 8 then 'PRODUCAO' --DOBRA
		when 88 then 'PRODUCAO' --DOBRA
		when 234 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 210 then 'PRODUCAO' --MÉTODOS E PROCESSOS
		when 237 then 'PRODUCAO' --ENGENHARIA DE MANUFATURA
		when 17 then 'PRODUCAO' --MANUTENCAO
		when 144 then 'PRODUCAO' --MANUTENÇÃO
		when 33 then 'PRODUCAO' --MONTAGEM
		when 90 then 'PRODUCAO' --MONTAGEM
		when 14 then 'PRODUCAO' --PCP
		when 10 then 'PRODUCAO' --PINTURA / JATO / LIMPEZA
		when 91 then 'PRODUCAO' --PINTURA
		when 33 then 'PRODUCAO' --PRODUÇÃO DIRETOS
		when 34 then 'PRODUCAO' --PRODUÇÃO INDIRETOS
		when 7 then 'PRODUCAO' --SOLDA
		when 92 then 'PRODUCAO' --SOLDA
		when 21 then 'PRODUCAO' --USINAGEM
		when 93 then 'PRODUCAO' --USINAGEM
		when 208 then 'SUPPLY CHAIN' --LOGISTICA
		when 37 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 85 then 'PÓS VENDA' --ASSISTENCIA TECNICA
		when 80 then 'SUPPLY CHAIN' --COMPRAS
		when 19 then 'SUPPLY CHAIN' --ESTOQUE
		when 44 then 'SUPPLY CHAIN' --ESTOQUE
		when 223 then 'SUPPLY CHAIN' --MERCADO ENTRADA
		when 224 then 'SUPPLY CHAIN' --MERCADO SAIDA
		when 86 then 'SUPPLY CHAIN' --LOGISTICA/FROTA
		when 25 then 'SUPPLY CHAIN' --PREDIOS E UTILIDADES
		when 15 then 'SUPPLY CHAIN' --QUALIDADE
		when 97 then 'SUPPLY CHAIN' --QUALIDADE
		when 226 then 'PÓS VENDA' --VENDAS DE PEÇAS
		else 'NÃO CLASSIFICADO'
	end as departamento,
	departamento.descri as departamento_sistema,
	lanc.hislan as historico_contabil,
		case lanc.orilan
		when 'ADI' then 'Adiantamento'
		when 'ANT' then 'Antecipação'
		when 'APA' then 'Apropriação de Antecipação'
		when 'APC' then 'Apropriação de Parcelas de Contrato'
		when 'BAD' then 'Baixa de Duplicatas'
		when 'BAN' then 'Banco'
		when 'BPC' then 'Baixa de Parcela de Contrato'
		when 'CAG' then 'Custo Agregado'
		when 'CTA' then 'Contratos'
		when 'DUP' then 'Duplicata'
		when 'ENT' then 'Entrada de Mercadoria'
		when 'FAT' then 'Faturamento'
		when 'IMP' then 'Importação (de lançamentos contábeis)'
		when 'MAN' then 'Manual'
		when 'MAP' then 'Mapa de Custo'
		when 'PAB' then 'Patrimonial'
		when 'PAD' then 'Depreciação'
		when 'TPC' then 'Apropriações de Contratos'
		when 'VDV' then 'Transf. Participante - Despesas de Viagens'
	end as origem_lanc
from 
	public.erp_placon hierarquia
	left join con_lancon lanc on hierarquia.codint = lanc.concre --Lançamento Contábil (ALTERAR condeb x concre)
	left join public.erp_placon conta on lanc.concre = conta.codint --Conta Contábil (ALTERAR condeb x concre)
	left join con_ratlan rateio on lanc.codigo = rateio.codigo --Rateio do Lançamento Contábil por Centro de Custos
	left join public.erp_centro centro on rateio.codcen = centro.codigo --Centro Resultado
	left join public.erp_caddep departamento on centro.coddep = departamento.codigo
	left join public.erp_placon g1 on g1.clacon = substring(hierarquia.clacon,1,1)
	left join public.erp_placon g2 on g2.clacon = substring(hierarquia.clacon,1,2)
	left join public.erp_placon g3 on g3.clacon = substring(hierarquia.clacon,1,3)
	left join public.erp_placon g4 on g4.clacon = substring(hierarquia.clacon,1,5)
	left join public.erp_placon g5 on g5.clacon = substring(hierarquia.clacon,1,7)
	left join public.erp_placon g6 on g6.clacon = substring(hierarquia.clacon,1,9)
where
	lanc.coduni in (136,137)
	and g5.clacon = '4110101'
	and not (hierarquia.sinana = 'A' and lanc.codigo is null) -- Pra não trazer as contas analíticas que estão sem nenhum lançamento
	and lanc.orilan <> 'Z' --Ignorar lançamentos de 'Transferência de Valores Para Conta de Resultado'
) z