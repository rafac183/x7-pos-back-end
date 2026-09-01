"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const items_service_1 = require("./src/inventory/products-inventory/stocks/items/items.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const itemsService = app.get(items_service_1.ItemsService);
    try {
        console.log('Ejecutando itemsService.findAll...');
        const result = await itemsService.findAll({ page: 1, limit: 100 }, 2);
        console.log('Result:', result.data.length);
    }
    catch (err) {
        console.error('ERROR DETECTADO EN ITEMS SERVICE:');
        console.error(err);
    }
    finally {
        await app.close();
    }
}
bootstrap();
//# sourceMappingURL=test-items-service-ts.js.map