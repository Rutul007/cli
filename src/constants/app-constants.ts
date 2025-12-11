export let dockerComposeAcr: string = '';
export let deleteAcrToken: string = '';

export const setDockerComposeAcr = (value: string): void => {
    dockerComposeAcr = value;
};

export const setDeleteAcrToken = (value: string): void => {
    deleteAcrToken = value;
};