const fs = require('fs')
const path = require('path')

const jsonSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'migration-map-cluster-new.json'), 'utf8'))

function getType(schema) {
    if(typeof schema.type === 'string'){
        return schema.type
    }else if(Array.isArray(schema.type)){
        // Return first element of Array that is not "null"
        return schema.type.find((item) => item !== 'null')
    }
}

async function loopNestedJsonSchema(jsonSchema, level = 0) {
    let md = '';
    if(jsonSchema.title) {
        md += `\n\n${ '#'.repeat(level) } ${jsonSchema.title}\n\n`;
    }
    level++;

    for (const key in jsonSchema.properties) {
        const property = jsonSchema.properties[key];
        //md += `## ${key}\n\n`;

        const type = getType(property);

        if (type === 'object') {

            md += await loopNestedJsonSchema(property, level);

        } else if (type === 'array') {
 
            if(!property.items) {
                console.log(property);
            }

            md += await loopNestedJsonSchema(property.items, level);

        } else {

            md += `\n\n\n\n${ '#'.repeat(level) } ${key} \n\n`;
            md += '```Type: ' + property.type + '\n\n';
            md += `Title: ${property.title}\n\n`;
            md += `Description: ${property.description}\n\n`;
            if(property.$migration?.nfi2022?.pointer)
                md += `Previous: ${property.$migration.nfi2022.pointer}\n\n`
            md += '```';

        }
    }

    return md;
}

async function loopNestedJsonSchemaAsTable(jsonSchema, level = 0, parentKey = '') {
    let md = '';
    /*if(jsonSchema.title) {
        md += `\n\n${ '#'.repeat(level) } ${jsonSchema.title}\n\n`;
    }*/
    level++;

    for (const key in jsonSchema.properties) {
        const property = jsonSchema.properties[key];
        //md += `## ${key}\n\n`;

        const type = getType(property);

        if (type === 'object') {
            md += await loopNestedJsonSchemaAsTable(property, level, `${key}`);

        } else if (type === 'array') {
 
            
            md += await loopNestedJsonSchemaAsTable(property.items, level, `${key}`);

        } else {
            const ci2017 = property.$migration?.ci2017?.table ? (property.$migration?.ci2017?.table || '') + '.' + (property.$migration?.ci2017?.column || '') : '<sub>noch nicht dokumentiert</sub>';
            const bwi2012 = property.$migration?.bwi2012?.table ? (property.$migration?.bwi2012?.table || '') + '.' + (property.$migration?.bwi2012?.column || '') : '<sub>noch nicht dokumentiert</sub>';

            md += `| ${parentKey}.${key} | ${property.$migration?.nfi2022?.pointer} | ${ci2017} | ${bwi2012} | ${property.type} | ${property.title} | ${property.description} | ${property.$migration?.nfi2022?.lookup || '' } |\n`;

        }
    }

    return md;
}
/**
 * Create a markdown file documentation from a JSON schema
 * @param {Object} schema - JSON schema
 */
async function main(jsonSchema) {
    let md = `
# Migration

The following table shows the migration path from the source database to the target database.\n`;
    md += 'Current DB | bwi2022 | ci2017 | bwi2012 | Type | Title | Description | Lookup |\n';
    md += '| --- | --- | --- | --- | --- | --- | --- | --- |\n';
    md += await loopNestedJsonSchemaAsTable(jsonSchema, 1, 'cluster');

    return fs.writeFileSync(path.resolve(__dirname, '../migration.md'), md);
}

main(jsonSchema);