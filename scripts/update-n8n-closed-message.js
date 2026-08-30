const fs = require("fs");
const path = require("path");

const files = process.argv.length > 2 ? process.argv.slice(2).map(file => path.resolve(file)) : [
  path.resolve(__dirname, "../docs/n8n-workflows/vib-pizzaria-big-burguer-recepcao-ia.json"),
  path.resolve(__dirname, "../../n8n/K2GVMhLFIkh70Egi-nodes-current.json"),
  path.resolve(__dirname, "../../n8n/K2GVMhLFIkh70Egi-nodes-link-reception.json")
];

const closedMessageBlock = `function isWithinBusinessHours(contextPayload) {
  const source = contextPayload.context || contextPayload;
  const timezone = source.settings?.timezone || 'America/Sao_Paulo';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
    .formatToParts(new Date())
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  const weekMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekMap[parts.weekday] ?? new Date().getDay();
  const currentTime = \`\${parts.hour || '00'}:\${parts.minute || '00'}\`;
  const todaysHours = (source.businessHours || []).find(hour =>
    Number(hour.dayOfWeek) === dayOfWeek && String(hour.type || 'normal') === 'normal'
  );
  return Boolean(
    todaysHours &&
    !todaysHours.isClosed &&
    todaysHours.openTime &&
    todaysHours.closeTime &&
    currentTime >= todaysHours.openTime &&
    currentTime <= todaysHours.closeTime
  );
}

function closedMessage() {
  return [
    \`\${greeting()} No momento ainda nao estamos funcionando.\`,
    '',
    'Horario de funcionamento:',
    'Quinta-feira: 18:00 as 22:30',
    'Sexta-feira: 18:00 as 22:30',
    'Sabado: 18:00 as 23:00',
    'Domingo: 18:00 as 23:00'
  ].join('\\n');
}

function humanMessage`;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.warn(`Ignorado, arquivo nao encontrado: ${file}`);
    continue;
  }

  const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
  const nodes = Array.isArray(workflow)
    ? (workflow[0]?.nodes ? workflow[0].nodes : workflow)
    : workflow.nodes || [];
  const node = nodes.find(item => item.name === "Orquestrador IA e acoes SaaS");

  if (!node?.parameters?.jsCode) {
    console.warn(`Ignorado, node nao encontrado: ${file}`);
    continue;
  }

  let jsCode = node.parameters.jsCode;
  const original = jsCode;

  if (jsCode.includes("function closedMessage")) {
    jsCode = jsCode.replace(
      /(?:function isWithinBusinessHours[\s\S]*?\n\n)*function closedMessage\(\) \{[\s\S]*?\nfunction humanMessage/,
      closedMessageBlock
    );
    jsCode = jsCode.replace(
      /else if \(company\.acceptOrders === false(?: \|\| !isWithinBusinessHours\(context\))?\) \{/g,
      "else if (company.acceptOrders === false || !isWithinBusinessHours(context)) {"
    );
    jsCode = jsCode.replace(
      /storeOpen: company\.acceptOrders !== false(?: && isWithinBusinessHours\(context\))?/g,
      "storeOpen: company.acceptOrders !== false && isWithinBusinessHours(context)"
    );
  } else if (jsCode.includes("context.company?.acceptOrders === false")) {
    const currentWorkflowClosedGate = `${closedMessageBlock
      .replace(/\nfunction humanMessage$/, "")
      .replace("function closedMessage() {", "function closedStoreMessage() {")
      .replace("`${greeting()} No momento ainda nao estamos funcionando.`", "'No momento ainda nao estamos funcionando.'")}

if (context.company?.acceptOrders === false || !isWithinBusinessHours(context)) {
  return [{
    json: {
      output: [{
        type: 'message',
        text: closedStoreMessage()
      }],
      actionResults: [],
      storeClosed: true
    }
  }];
}

const pizzaQuotes`;

    jsCode = jsCode.replace(
      /if \(context\.company\?\.acceptOrders === false\) \{[\s\S]*?\n\}\n\nconst pizzaQuotes/,
      currentWorkflowClosedGate
    );
  }

  if (jsCode === original) {
    console.warn(`Nenhuma alteracao aplicada em ${file}`);
    continue;
  }

  node.parameters.jsCode = jsCode;
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + "\n");
  console.log(`Atualizado: ${file}`);
}
