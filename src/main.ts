import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || Number(process.env.PORT);
  await app.listen(port);
  console.log(`Serviço financeiro iniciado com sucesso na porta ${port}`);
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
