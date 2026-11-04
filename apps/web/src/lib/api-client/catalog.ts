import type { AxiosInstance } from 'axios';
import type {
  Category, CategoryInput, ModifierGroup, ModifierGroupInput, ModifierOptionInput, Product, ProductInput, ProductStatus,
  TopSeller,
} from '../api-types';

export function createCatalogApi(client: AxiosInstance) {
  return {
    async listCategories(businessId: string): Promise<Category[]> {
      return (await client.get(`/businesses/${businessId}/categories`)).data;
    },

    async createCategory(businessId: string, data: CategoryInput): Promise<Category> {
      return (await client.post(`/businesses/${businessId}/categories`, data)).data;
    },

    async updateCategory(businessId: string, categoryId: string, data: Partial<CategoryInput>): Promise<Category> {
      return (await client.put(`/businesses/${businessId}/categories/${categoryId}`, data)).data;
    },

    async deleteCategory(businessId: string, categoryId: string): Promise<void> {
      await client.delete(`/businesses/${businessId}/categories/${categoryId}`);
    },

    async listProducts(businessId: string, filters: { categoryId?: string; status?: ProductStatus; activeOnly?: boolean } = {}): Promise<Product[]> {
      return (await client.get(`/businesses/${businessId}/products`, { params: filters })).data;
    },

    async createProduct(businessId: string, data: ProductInput): Promise<Product> {
      return (await client.post(`/businesses/${businessId}/products`, data)).data;
    },

    async updateProduct(businessId: string, productId: string, data: Partial<ProductInput>): Promise<Product> {
      return (await client.put(`/businesses/${businessId}/products/${productId}`, data)).data;
    },

    async deleteProduct(businessId: string, productId: string): Promise<void> {
      await client.delete(`/businesses/${businessId}/products/${productId}`);
    },

    async setProductFavorite(businessId: string, productId: string, isFavorite: boolean): Promise<Product> {
      return (await client.put(`/businesses/${businessId}/products/${productId}`, { isFavorite })).data;
    },

    async getTopSellers(businessId: string, query: { days?: number; limit?: number } = {}): Promise<TopSeller[]> {
      return (await client.get(`/businesses/${businessId}/products/top-sellers`, { params: query })).data;
    },

    async listModifierGroups(businessId: string): Promise<ModifierGroup[]> {
      return (await client.get(`/businesses/${businessId}/modifier-groups`)).data;
    },

    async createModifierGroup(businessId: string, data: ModifierGroupInput): Promise<ModifierGroup> {
      return (await client.post(`/businesses/${businessId}/modifier-groups`, data)).data;
    },

    async updateModifierGroup(businessId: string, groupId: string, data: Omit<Partial<ModifierGroupInput>, 'options' | 'displayOrder'>): Promise<ModifierGroup> {
      return (await client.put(`/businesses/${businessId}/modifier-groups/${groupId}`, data)).data;
    },

    async addModifierOption(businessId: string, groupId: string, data: ModifierOptionInput): Promise<ModifierGroup> {
      return (await client.post(`/businesses/${businessId}/modifier-groups/${groupId}/options`, data)).data;
    },

    async removeModifierOption(businessId: string, groupId: string, optionId: string): Promise<void> {
      await client.delete(`/businesses/${businessId}/modifier-groups/${groupId}/options/${optionId}`);
    },

    async deleteModifierGroup(businessId: string, groupId: string): Promise<void> {
      await client.delete(`/businesses/${businessId}/modifier-groups/${groupId}`);
    },
  };
}
