import { applyDecorators, Type } from '@nestjs/common';
import { ApiCreatedResponse, ApiExtraModels, ApiOkResponse, ApiProperty } from '@nestjs/swagger';

import { SuccessEnvelope } from './response.envelope';

const responseCache = new Map<string, { cls: Type; sourceDto: Type }>();

function getOrCreate(cacheKey: string, sourceDto: Type, factory: () => Type): Type {
  const cached = responseCache.get(cacheKey);
  if (cached) {
    if (cached.sourceDto !== sourceDto) {
      throw new Error(
        `[ResponseDecorator] Cache key collision: "${cacheKey}" is already registered by a different DTO class. Ensure all DTO class names are unique.`,
      );
    }
    return cached.cls;
  }
  const cls = factory();
  responseCache.set(cacheKey, { cls, sourceDto });
  return cls;
}

export function ApiDataResponse(dataDto: Type, status: 200 | 201 = 200) {
  const responseClass = getOrCreate(`Data:${dataDto.name}`, dataDto, () => {
    class DataResponse extends SuccessEnvelope {
      data!: any;
    }
    ApiProperty({ type: dataDto })(DataResponse.prototype, 'data');
    Object.defineProperty(DataResponse, 'name', {
      value: `${dataDto.name}Response`,
    });
    return DataResponse;
  });

  const apiResponse =
    status === 201 ? ApiCreatedResponse({ type: responseClass }) : ApiOkResponse({ type: responseClass });
  return applyDecorators(ApiExtraModels(responseClass), apiResponse);
}

export function ApiListResponse(listDto: Type) {
  const responseClass = getOrCreate(`List:${listDto.name}`, listDto, () => {
    class ListData {
      list!: any[];
      count!: number;
    }
    ApiProperty({ type: [listDto] })(ListData.prototype, 'list');
    ApiProperty({ type: Number })(ListData.prototype, 'count');
    Object.defineProperty(ListData, 'name', {
      value: `${listDto.name}ListData`,
    });

    class ListResponse extends SuccessEnvelope {
      data!: ListData;
    }
    ApiProperty({ type: ListData })(ListResponse.prototype, 'data');
    Object.defineProperty(ListResponse, 'name', {
      value: `${listDto.name}ListResponse`,
    });
    return ListResponse;
  });

  return applyDecorators(ApiExtraModels(responseClass), ApiOkResponse({ type: responseClass }));
}

export function ApiPageResponse(itemDto: Type) {
  const responseClass = getOrCreate(`Page:${itemDto.name}`, itemDto, () => {
    class PageData {
      list!: any[];
      count!: number;
    }
    ApiProperty({ type: [itemDto] })(PageData.prototype, 'list');
    ApiProperty({ type: Number })(PageData.prototype, 'count');
    Object.defineProperty(PageData, 'name', {
      value: `${itemDto.name}PageData`,
    });

    class PageResponse extends SuccessEnvelope {
      data!: PageData;
    }
    ApiProperty({ type: PageData })(PageResponse.prototype, 'data');
    Object.defineProperty(PageResponse, 'name', {
      value: `${itemDto.name}PageResponse`,
    });
    return PageResponse;
  });

  return applyDecorators(ApiExtraModels(responseClass), ApiOkResponse({ type: responseClass }));
}

export function ApiCursorPageResponse(itemDto: Type) {
  const responseClass = getOrCreate(`CursorPage:${itemDto.name}`, itemDto, () => {
    class CursorPageData {
      list!: any[];
      nextPageCursor?: string;
    }
    ApiProperty({ type: [itemDto] })(CursorPageData.prototype, 'list');
    ApiProperty({ type: String, required: false })(CursorPageData.prototype, 'nextPageCursor');
    Object.defineProperty(CursorPageData, 'name', {
      value: `${itemDto.name}CursorPageData`,
    });

    class CursorPageResponse extends SuccessEnvelope {
      data!: CursorPageData;
    }
    ApiProperty({ type: CursorPageData })(CursorPageResponse.prototype, 'data');
    Object.defineProperty(CursorPageResponse, 'name', {
      value: `${itemDto.name}CursorPageResponse`,
    });
    return CursorPageResponse;
  });

  return applyDecorators(ApiExtraModels(responseClass), ApiOkResponse({ type: responseClass }));
}

export function ApiEmptyResponse() {
  return applyDecorators(ApiExtraModels(SuccessEnvelope), ApiOkResponse({ type: SuccessEnvelope }));
}
