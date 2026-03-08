/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "next/dist/shared/lib/router/router" {
  export type RouteImpl<T> = string;
}

declare namespace __next_route_internal_types__ {
  export type RouteImpl<T> = string;
  export type Route = string;
}
