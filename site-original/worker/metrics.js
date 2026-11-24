async function periodMetrics(env,period,publication){
 const registrations=await env.DB.prepare('SELECT tipo,count(*) AS total FROM cadastros WHERE substr(criado_em,1,7)=? GROUP BY tipo').bind(period).all();
 const operations=await env.DB.prepare('SELECT tipo,SUM(quantidade) AS total FROM registros_operacionais WHERE substr(data_ocorrencia,1,7)=? GROUP BY tipo').bind(period).all();
 const total=registrations.results.reduce((a,r)=>a+r.total,0),base=publication?{pessoas:publication.pessoas,atendimentos:publication.atendimentos,cestas:publication.cestas,voluntarios:publication.voluntarios}:null;
 return{cadastros:total,pessoas:total+(base?.pessoas||0),voluntarios:(base?.voluntarios||0)+(registrations.results.find(r=>r.tipo==='voluntariado')?.total||0),atendimentos:(base?.atendimentos||0)+(operations.results.find(r=>r.tipo==='atendimento')?.total||0),cestas:(base?.cestas||0)+(operations.results.find(r=>r.tipo==='cesta')?.total||0),base,tipos:registrations.results,operacoes:operations.results};
}
